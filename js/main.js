/* =====================================================
   Section: مراحل تطوير التطبيق
   المحتوى static في الـ HTML. الـ JS مسؤول عن:
   1) حساب مسار الخط المنقط (بيتغير حسب حجم الشاشة)
   2) أنيميشن رسم الخط + ظهور كل كارد لما الخط يوصله
   3) بعد الرسم: النقط بتتحرك + نقطة منورة بتمشي على الخط
      وكل دايرة بتنبض لما النقطة تعدي عليها
   (لو مسحتي الـ svg من الـ HTML الكروت بتظهر عادي من غير خط)
===================================================== */

(() => {
    const section = document.getElementById("steps");
    const row = document.getElementById("steps-track");
    if (!section || !row) return;

    const NS = "http://www.w3.org/2000/svg";
    const SPEED = 280;      // سرعة النقطة بالبكسل/ثانية (ثابتة على كل الشاشات)
    const PAUSE = 0.9;      // وقفة بسيطة قبل ما النقطة تبدأ تاني (ثانية)
    const FADE = 26;        // مسافة الظهور/الاختفاء في أول وآخر كل مقطع (بكسل)

    const svg = row.querySelector(".steps__path");
    const dots = svg && svg.querySelector(".steps__dots");
    const maskPath = svg && svg.querySelector(".steps__mask-path");
    const pulse = svg && svg.querySelector(".steps__pulse");
    const hasPath = Boolean(dots && maskPath);

    const steps = [...row.querySelectorAll(".step")];
    const badges = steps.map((s) => s.querySelector(".step-badge"));
    const desktop = window.matchMedia("(min-width: 1200px)"); // xl = 4 كروت في صف
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // بيانات المسار (بتتحسب في drawPath)
    let total = 0;
    let breaks = [];      // نهاية كل مقطع من الخط (مسافة تراكمية)
    let badgeDist = [];   // بُعد كل دايرة على الخط
    let drawSeconds = 2.4;

    // حالة الأنيميشن
    let drawn = false;
    let inView = false;
    let pulseOn = false;
    let raf = 0;
    let startT = 0;
    let lastDist = -1;

    section.classList.add("js");

    /* ---------- مراكز الدواير بالنسبة للـ row (01 → 04) ---------- */
    function getPoints() {
        const rowRect = row.getBoundingClientRect();
        return badges.map((b) => {
            const r = b.getBoundingClientRect();
            return {
                x: r.left + r.width / 2 - rowRect.left,
                y: r.top + r.height / 2 - rowRect.top,
            };
        });
    }

    /* منحنى بين نقطتين: أفقي لو المسافة الأفقية أكبر، رأسي لو العكس */
    function curve(p0, p1) {
        const dx = Math.abs(p1.x - p0.x);
        const dy = Math.abs(p1.y - p0.y);
        if (dx >= dy) {
            const mx = (p0.x + p1.x) / 2;
            return ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
        }
        const my = (p0.y + p1.y) / 2;
        return ` C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`;
    }

    function measure(d) {
        const tmp = document.createElementNS(NS, "path");
        tmp.setAttribute("d", d);
        svg.appendChild(tmp);
        const len = tmp.getTotalLength();
        tmp.remove();
        return len;
    }

    function drawPath() {
        if (!hasPath) return;

        const points = getPoints();
        const route = [...points];

        // ذيل البداية (xl بس): بيطلع برا ناحية أول دايرة
        // عربي: 01 على اليمين فالذيل يمين | إنجليزي: 01 على الشمال فالذيل شمال
        if (desktop.matches) {
            const side = getComputedStyle(row).direction === "rtl" ? 1 : -1;
            route.unshift({ x: points[0].x + 45 * side, y: points[0].y + 30 });
        }

        // الخط بيتقسم لمقاطع: على التابلت مفيش خط قطري بين صفين
        const segments = [];
        let cur = `M ${route[0].x} ${route[0].y}`;
        for (let i = 1; i < route.length; i++) {
            const a = route[i - 1];
            const b = route[i];
            const diagonal = Math.abs(b.x - a.x) > 40 && Math.abs(b.y - a.y) > 40;
            if (!desktop.matches && diagonal) {
                segments.push(cur);
                cur = `M ${b.x} ${b.y}`;
            } else {
                cur += curve(a, b);
            }
        }
        segments.push(cur);

        const d = segments.join(" ");
        dots.setAttribute("d", d);
        maskPath.setAttribute("d", d);

        // أطوال المقاطع (عشان النقطة المنورة ما تقفزش بين المقاطع)
        let acc = 0;
        breaks = segments.map((seg) => (acc += measure(seg)));

        total = maskPath.getTotalLength();
        drawSeconds = Math.min(Math.max(total / 450, 1.6), 3.6);
        section.style.setProperty("--draw", `${drawSeconds}s`);
        maskPath.style.setProperty("--len", total);

        scheduleSteps(points);
    }

    /* كل كارد يظهر في اللحظة اللي الخط يوصل لدايرته + نخزن بُعد كل دايرة */
    function scheduleSteps(points) {
        const samples = 240;
        const lengths = [];
        for (let i = 0; i <= samples; i++) {
            const l = (total * i) / samples;
            const p = maskPath.getPointAtLength(l);
            lengths.push({ l, x: p.x, y: p.y });
        }

        badgeDist = steps.map((step, i) => {
            let best = lengths[0];
            let bestDist = Infinity;
            lengths.forEach((s) => {
                const dist = (s.x - points[i].x) ** 2 + (s.y - points[i].y) ** 2;
                if (dist < bestDist) { bestDist = dist; best = s; }
            });
            const delay = 0.2 + (best.l / total) * drawSeconds - 0.1;
            step.style.setProperty("--d", `${Math.max(delay, 0).toFixed(2)}s`);
            return best.l;
        });
    }

    /* ---------- النقطة المنورة ---------- */
    function ping(badge) {
        badge.classList.remove("is-ping");
        void badge.offsetWidth; // يعيد تشغيل الأنيميشن
        badge.classList.add("is-ping");
        badge.addEventListener("animationend", () => badge.classList.remove("is-ping"), { once: true });
    }

    function frame(now) {
        if (!pulseOn) return;

        const travel = total / SPEED;
        const t = ((now - startT) / 1000) % (travel + PAUSE);

        if (t > travel) {                 // وقفة بين اللفات
            pulse.style.opacity = 0;
            lastDist = -1;
        } else {
            const dist = (t / travel) * total;

            // المقطع الحالي (للظهور/الاختفاء عند أطرافه)
            let k = breaks.findIndex((end) => dist <= end);
            if (k < 0) k = breaks.length - 1;
            const segStart = k === 0 ? 0 : breaks[k - 1];
            const fade = Math.min(1, (dist - segStart) / FADE, (breaks[k] - dist) / FADE);

            const pt = maskPath.getPointAtLength(dist);
            pulse.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
            pulse.style.opacity = Math.max(fade, 0);

            // نبضة للدايرة اللي النقطة عدّت عليها
            badgeDist.forEach((bd, i) => {
                if (lastDist <= bd && dist >= bd) ping(badges[i]);
            });
            lastDist = dist;
        }
        raf = requestAnimationFrame(frame);
    }

    function startPulse() {
        if (!pulse || !hasPath || reduceMotion || pulseOn || !drawn || !inView) return;
        pulseOn = true;
        startT = performance.now();
        lastDist = -1;
        raf = requestAnimationFrame(frame);
    }

    function stopPulse() {
        pulseOn = false;
        cancelAnimationFrame(raf);
    }

    /* ---------- Init ---------- */
    drawPath();

    // من غير خط: ظهور متتابع بسيط
    if (!hasPath) {
        steps.forEach((step, i) => step.style.setProperty("--d", `${i * 0.15}s`));
    }

    // Reveal مرة واحدة لما السكشن يظهر + بعد الرسم نبدأ الحركة المستمرة
    const reveal = new IntersectionObserver(
        ([entry]) => {
            if (!entry.isIntersecting) return;
            section.classList.add("is-visible");
            reveal.disconnect();

            setTimeout(() => {
                drawn = true;
                section.classList.add("is-drawn");
                startPulse();
            }, hasPath ? (0.2 + drawSeconds) * 1000 + 150 : 0);
        },
        { threshold: 0.1 }
    );
    reveal.observe(section);

    // الحركة بتقف لما السكشن يطلع من الشاشة (توفير للبطارية)
    new IntersectionObserver(
        ([entry]) => {
            inView = entry.isIntersecting;
            inView ? startPulse() : stopPulse();
        },
        { threshold: 0 }
    ).observe(section);

    let timer;
    window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(drawPath, 120);
    });
    window.addEventListener("load", drawPath);

    // لو اللغة/الاتجاه اتغيّر والصفحة مفتوحة (dir أو lang على <html>) نعيد رسم الخط
    new MutationObserver(() => setTimeout(drawPath, 100)).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["dir", "lang"],
    });
})();


/* =====================================================
   Section: آراء العملاء — بلاير الصوت
   الهوفر والستايل كله CSS. الـ JS للبلاير بس:
   - data-src فيه رابط الملف  → بيشغّل التسجيل الحقيقي
   - data-src فاضي            → تشغيل تجريبي بتايمر (للتصميم بس)
   - data-duration اختياري مع الملف الحقيقي (بياخد المدة من الملف نفسه)
===================================================== */
(() => {
    const BARS = 56;
    let activePlayer = null; // بلاير واحد بس يشتغل في نفس الوقت

    const clamp = (n, min = 0, max = 1) => Math.min(Math.max(n, min), max);

    const fmt = (s) => {
        s = Math.max(0, Math.round(s));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };

    // رقم عشوائي ثابت (نفس الموجة في كل تحميل)
    const mulberry32 = (a) => () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    function initPlayer(el, index) {
        const btn = el.querySelector(".player-btn");
        const icon = btn.querySelector("i");
        const wave = el.querySelector(".player-wave");
        const time = el.querySelector(".player-time");

        const src = (el.dataset.src || "").trim();
        const audio = src ? new Audio() : null;

        let duration = parseFloat(el.dataset.duration) || (audio ? 0 : 35);
        let progress = clamp(parseFloat(el.dataset.start) || 0);
        let started = false;
        let playing = false;
        let demoTimer = 0;
        let t0 = 0;
        let bars = [];

        if (audio) {
            audio.preload = "metadata"; // نحمّل المدة بس من غير ما نحمّل الملف كله
            audio.src = src;
        }

        /* الموجة: عدد الأعمدة بيتحسب حسب العرض المتاح */
        function buildWave() {
            const count = Math.min(Math.max(Math.floor(wave.clientWidth / 6), 18), BARS);
            if (count === bars.length) return;

            const rnd = mulberry32(index * 97 + 13);
            wave.innerHTML = "";
            bars = [];
            for (let i = 0; i < count; i++) {
                const envelope = 0.35 + 0.65 * Math.sin((Math.PI * (i + 0.5)) / count);
                const h = Math.min(100, 14 + 86 * Math.pow(rnd(), 0.8) * envelope);
                const bar = document.createElement("span");
                bar.style.height = `${h}%`;
                wave.appendChild(bar);
                bars.push(bar);
            }
        }

        function render() {
            const played = Math.round(progress * bars.length);
            bars.forEach((b, i) => b.classList.toggle("is-played", i < played));
            time.textContent = fmt(started ? duration * (1 - progress) : duration);
        }

        function setPlaying(value) {
            playing = value;
            icon.classList.toggle("fa-play", !playing);
            icon.classList.toggle("fa-pause", playing);
            btn.setAttribute("aria-label", playing ? "إيقاف التسجيل" : "تشغيل التسجيل");
        }

        function play() {
            if (activePlayer && activePlayer !== api) activePlayer.pause();
            activePlayer = api;
            started = true;
            setPlaying(true);

            if (audio) {
                if (duration && progress > 0) audio.currentTime = progress * duration;
                audio.play().catch(() => setPlaying(false));
            } else {
                t0 = Date.now() - progress * duration * 1000;
                demoTimer = setInterval(() => {
                    progress = (Date.now() - t0) / (duration * 1000);
                    progress >= 1 ? finish() : render();
                }, 200);
            }
        }

        function pause() {
            clearInterval(demoTimer);
            if (audio) audio.pause();
            setPlaying(false);
        }

        function finish() {
            pause();
            progress = 0;
            started = false;
            if (audio) audio.currentTime = 0;
            render();
        }

        const api = { pause };

        btn.addEventListener("click", () => (playing ? pause() : play()));

        // الضغط على الموجة = تقديم/تأخير (البداية من اليمين لأن الصفحة RTL)
        wave.addEventListener("click", (e) => {
            if (audio && !duration) return; // لسه المدة ما اتحمّلتش
            const rect = wave.getBoundingClientRect();
            progress = clamp((rect.right - e.clientX) / rect.width);
            started = true;
            if (audio) audio.currentTime = progress * duration;
            else if (playing) t0 = Date.now() - progress * duration * 1000;
            render();
        });

        if (audio) {
            audio.addEventListener("loadedmetadata", () => {
                duration = audio.duration;
                render();
            });
            audio.addEventListener("timeupdate", () => {
                if (!duration) return;
                progress = clamp(audio.currentTime / duration);
                render();
            });
            audio.addEventListener("ended", finish);
            audio.addEventListener("error", () => {
                pause();
                el.classList.add("is-error");
                btn.disabled = true;
                btn.setAttribute("aria-label", "تعذّر تحميل التسجيل");
            });
        }

        buildWave();
        render();
        setPlaying(false);

        let waveTimer;
        window.addEventListener("resize", () => {
            clearTimeout(waveTimer);
            waveTimer = setTimeout(() => { buildWave(); render(); }, 150);
        });
    }

    document.querySelectorAll(".player").forEach(initPlayer);
})();
