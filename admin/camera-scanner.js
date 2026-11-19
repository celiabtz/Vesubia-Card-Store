/* ==========================================
   VESUBIA CARD STORE
   CAMERA SCANNER - ADMIN INTEGRATION
========================================== */

(() => {
    "use strict";

    const openButton = document.getElementById("open-camera-button");
    const captureButton = document.getElementById("capture-card-button");
    const closeButton = document.getElementById("close-camera-button");

    const panel = document.getElementById("camera-panel");
    const video = document.getElementById("camera-video");
    const canvas = document.getElementById("camera-canvas");

    const imageInput = document.getElementById("product-image");

    if (
        !openButton ||
        !captureButton ||
        !closeButton ||
        !panel ||
        !video ||
        !canvas ||
        !imageInput
    ) {
        console.warn("Vesubia Camera : éléments HTML manquants.");
        return;
    }

    let cameraStream = null;
    let isCapturing = false;


    // ==========================================
    // OUVERTURE CAMERA
    // ==========================================

    async function openCamera() {

        try {

            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Caméra non disponible.");
            }

            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            video.srcObject = cameraStream;

            panel.hidden = false;
            openButton.hidden = true;

            await video.play();

        } catch (error) {

            console.error("Vesubia Camera :", error);

            alert(
                "Impossible d'ouvrir la caméra. Vérifie les autorisations de ton navigateur."
            );

            stopCamera();

        }

    }


    // ==========================================
    // FERMETURE CAMERA
    // ==========================================

    function stopCamera() {

        if (cameraStream) {

            cameraStream.getTracks().forEach(track => track.stop());

            cameraStream = null;

        }

        video.srcObject = null;

        panel.hidden = true;
        openButton.hidden = false;

    }


    // ==========================================
    // CAPTURE ET TRANSFERT VERS ADMIN
    // ==========================================

    async function capturePhoto() {

        if (isCapturing) return;

        if (!video.videoWidth || !video.videoHeight) {

            alert("La caméra n'est pas encore prête.");
            return;

        }

        isCapturing = true;
        captureButton.disabled = true;

        try {

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext("2d");

            context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const blob = await new Promise(resolve => {

                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.95
                );

            });

            if (!blob) {
                throw new Error("Capture photo impossible.");
            }

            const photoFile = new File(
                [blob],
                "vesubia-camera.jpg",
                {
                    type: "image/jpeg",
                    lastModified: Date.now()
                }
            );

            const transfer = new DataTransfer();

            transfer.items.add(photoFile);

            imageInput.files = transfer.files;

            imageInput.dispatchEvent(
                new Event("change", { bubbles: true })
            );

            stopCamera();

        } catch (error) {

            console.error("Capture Vesubia :", error);

            alert("Une erreur est survenue pendant la capture.");

        } finally {

            isCapturing = false;
            captureButton.disabled = false;

        }

    }


    // ==========================================
    // EVENEMENTS
    // ==========================================

    openButton.addEventListener("click", openCamera);

    captureButton.addEventListener("click", capturePhoto);

    closeButton.addEventListener("click", stopCamera);


    // Arrêt de la caméra si l'utilisateur quitte la page

    window.addEventListener("pagehide", stopCamera);

})();
