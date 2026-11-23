
document.addEventListener("DOMContentLoaded", () => {
    const openButton = document.getElementById("rare-open-camera-button");
    const captureButton = document.getElementById("rare-capture-card-button");
    const closeButton = document.getElementById("rare-close-camera-button");
    const panel = document.getElementById("rare-camera-panel");
    const video = document.getElementById("rare-camera-video");
    const canvas = document.getElementById("rare-camera-canvas");
    const imageInput = document.getElementById("card-image");

    if (!openButton || !captureButton || !closeButton || !panel || !video || !canvas || !imageInput) {
        return;
    }

    let cameraStream = null;

    async function startCamera() {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
                audio: false
            });

            video.srcObject = cameraStream;
            panel.hidden = false;
            await video.play();

        } catch (error) {
            console.error("Erreur caméra :", error);
            alert("Impossible d'accéder à la caméra. Vérifie les autorisations.");
        }
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        video.srcObject = null;
        panel.hidden = true;
    }

    function capturePhoto() {
        if (!video.videoWidth || !video.videoHeight) {
            alert("La caméra n'est pas encore prête.");
            return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            if (!blob) {
                alert("Impossible de capturer la photo.");
                return;
            }

            const file = new File(
                [blob],
                "rare-card-photo.jpg",
                { type: "image/jpeg" }
            );

            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            imageInput.files = dataTransfer.files;

            imageInput.dispatchEvent(new Event("change", {
                bubbles: true
            }));

            stopCamera();
        }, "image/jpeg", 0.95);
    }

    openButton.addEventListener("click", startCamera);
    captureButton.addEventListener("click", capturePhoto);
    closeButton.addEventListener("click", stopCamera);

    window.addEventListener("beforeunload", stopCamera);
});
