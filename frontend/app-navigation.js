
(() => {
    const body = document.body;
    const backButton = document.getElementById("back-home");
    const homeLink = document.getElementById("home-link");

    const panels = {
        reader: document.getElementById("reader-panel"),
        scene: document.getElementById("scene-panel"),
        camera: document.getElementById("camera-panel"),
        voice: document.getElementById("voice-panel")
    };

    function showHome() {
        body.classList.remove("app-tool");
        body.classList.add("app-home");

        Object.values(panels).forEach(panel => {
            panel?.classList.remove("active");
        });

        window.scrollTo({ top: 0, behavior: "auto" });
    }

    function showTool(name) {
        const panel = panels[name];
        if (!panel) return;

        Object.values(panels).forEach(item => {
            item?.classList.remove("active");
        });

        panel.classList.add("active");
        body.classList.remove("app-home");
        body.classList.add("app-tool");

        window.scrollTo({ top: 0, behavior: "auto" });

        const heading = panel.querySelector("h2");
        if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus({ preventScroll: true });
        }
    }

    document.querySelectorAll("[data-open-tool]").forEach(button => {
        button.addEventListener("click", () => {
            showTool(button.dataset.openTool);
        });
    });

    backButton?.addEventListener("click", showHome);

    homeLink?.addEventListener("click", event => {
        event.preventDefault();
        showHome();
    });

    // Open the home screen first.
    showHome();
})();
