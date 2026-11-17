
window.recognizePokemonCard = async function (imageFile) {

    if (!window.Tesseract) {
        throw new Error("Tesseract n'est pas chargé.");
    }

    const image = await createImageBitmap(imageFile);

    // Préparer une zone de lecture
    async function readZone(x, y, width, height) {

        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * width);
        canvas.height = Math.round(image.height * height);

        const context = canvas.getContext("2d");

        context.drawImage(
            image,
            Math.round(image.width * x),
            Math.round(image.height * y),
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // Agrandir la zone pour faciliter la lecture
        const enlarged = document.createElement("canvas");
        enlarged.width = canvas.width * 2;
        enlarged.height = canvas.height * 2;

        const enlargedContext = enlarged.getContext("2d");
        enlargedContext.imageSmoothingEnabled = true;
        enlargedContext.imageSmoothingQuality = "high";

        enlargedContext.drawImage(
            canvas,
            0,
            0,
            enlarged.width,
            enlarged.height
        );

        const result = await Tesseract.recognize(
            enlarged,
            "fra+eng"
        );

        return result.data.text.trim();
    }

    try {

        // Zone supérieure : nom et points de vie
        const headerText = await readZone(
            0.10, 0.14, 0.80, 0.13
        );

        // Zone inférieure : numéro et extension
        const footerText = await readZone(
            0.10, 0.84, 0.80, 0.12
        );

        const result = {
            nameAndHP: headerText,
            collectionInfo: footerText
        };

        console.log("Nom et PV :", result.nameAndHP);
        console.log("Informations de collection :", result.collectionInfo);

        return result;

    } finally {
        image.close();
    }
};
