
// ==========================================
// VESUBIA CARD SCANNER — HD
// Détection, redressement et amélioration
// ==========================================

window.scanPokemonCard = async function (file) {

    if (typeof cv === "undefined" || !cv.Mat) {
        throw new Error("Le moteur OpenCV n'est pas prêt.");
    }

    if (!file || !file.type.startsWith("image/")) {
        throw new Error("Veuillez sélectionner une image valide.");
    }

    const image = await createImageBitmap(file);

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", {
        willReadFrequently: true
    });

    context.drawImage(image, 0, 0);
    image.close();

    const source = cv.imread(canvas);

    let gray = null;
    let blurred = null;
    let edges = null;
    let dilated = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;
    let result = null;
    let enhanced = null;
    let blurredImage = null;
    let srcPoints = null;
    let dstPoints = null;
    let matrix = null;

    try {

        // ==========================================
        // 1. PRÉPARATION DE L'IMAGE
        // ==========================================

        gray = new cv.Mat();
        blurred = new cv.Mat();
        edges = new cv.Mat();
        dilated = new cv.Mat();

        cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);

        cv.GaussianBlur(
            gray,
            blurred,
            new cv.Size(5, 5),
            0
        );

        cv.Canny(blurred, edges, 40, 130);

        kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, dilated, kernel);

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();

        cv.findContours(
            dilated,
            contours,
            hierarchy,
            cv.RETR_LIST,
            cv.CHAIN_APPROX_SIMPLE
        );

        // ==========================================
        // 2. DÉTECTION DU CONTOUR EXTÉRIEUR
        // ==========================================

        let bestCorners = null;
        let bestScore = 0;

        for (let i = 0; i < contours.size(); i++) {

            const contour = contours.get(i);
            const hull = new cv.Mat();
            const approx = new cv.Mat();

            try {

                cv.convexHull(contour, hull, false, true);

                const perimeter = cv.arcLength(hull, true);

                for (const tolerance of [
                    0.008,
                    0.012,
                    0.018,
                    0.025,
                    0.035
                ]) {

                    cv.approxPolyDP(
                        hull,
                        approx,
                        tolerance * perimeter,
                        true
                    );

                    if (
                        approx.rows !== 4 ||
                        !cv.isContourConvex(approx)
                    ) {
                        continue;
                    }

                    const points = [];

                    for (let j = 0; j < 4; j++) {
                        points.push({
                            x: approx.data32S[j * 2],
                            y: approx.data32S[j * 2 + 1]
                        });
                    }

                    // Trier les points autour du centre
                    const center = {
                        x: points.reduce((s, p) => s + p.x, 0) / 4,
                        y: points.reduce((s, p) => s + p.y, 0) / 4
                    };

                    points.sort((a, b) => {
                        return Math.atan2(
                            a.y - center.y,
                            a.x - center.x
                        ) - Math.atan2(
                            b.y - center.y,
                            b.x - center.x
                        );
                    });

                    // Commencer par le coin supérieur gauche
                    let startIndex = 0;
                    let smallestSum = Infinity;

                    points.forEach((p, index) => {
                        const sum = p.x + p.y;

                        if (sum < smallestSum) {
                            smallestSum = sum;
                            startIndex = index;
                        }
                    });

                    const ordered = [
                        ...points.slice(startIndex),
                        ...points.slice(0, startIndex)
                    ];

                    const topLeft = ordered[0];
                    const topRight = ordered[1];
                    const bottomRight = ordered[2];
                    const bottomLeft = ordered[3];

                    const distance = (a, b) =>
                        Math.hypot(
                            b.x - a.x,
                            b.y - a.y
                        );

                    const widthTop = distance(topLeft, topRight);
                    const widthBottom = distance(bottomLeft, bottomRight);
                    const heightLeft = distance(topLeft, bottomLeft);
                    const heightRight = distance(topRight, bottomRight);

                    const cardWidth =
                        (widthTop + widthBottom) / 2;

                    const cardHeight =
                        (heightLeft + heightRight) / 2;

                    const ratio = cardWidth / cardHeight;
                    const area = cv.contourArea(approx);

                    // Proportions d'une carte Pokémon
                    if (
                        ratio < 0.60 ||
                        ratio > 0.84 ||
                        cardWidth < source.cols * 0.15 ||
                        cardHeight < source.rows * 0.15 ||
                        area < source.cols * source.rows * 0.025
                    ) {
                        continue;
                    }

                    // Favoriser les cartes proches du ratio 0,72
                    const ratioScore =
                        1 - Math.abs(ratio - 0.72);

                    const score = area * ratioScore;

                    if (score > bestScore) {

                        // IMPORTANT : mémoriser le meilleur score
                        bestScore = score;

                        bestCorners = [
                            topLeft,
                            topRight,
                            bottomRight,
                            bottomLeft
                        ];
                    }
                }

            } finally {
                hull.delete();
                approx.delete();
                contour.delete();
            }
        }

        if (!bestCorners) {
            throw new Error(
                "Carte non détectée. Essaie avec un fond uni et contrasté."
            );
        }

        console.log("Vesubia : contour retenu", bestCorners);

        // ==========================================
        // 3. REDRESSEMENT DE LA PERSPECTIVE
        // ==========================================

        const width = 630;
        const height = 880;

        srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            bestCorners[0].x, bestCorners[0].y,
            bestCorners[1].x, bestCorners[1].y,
            bestCorners[2].x, bestCorners[2].y,
            bestCorners[3].x, bestCorners[3].y
        ]);

        dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            width - 1, 0,
            width - 1, height - 1,
            0, height - 1
        ]);

        matrix = cv.getPerspectiveTransform(
            srcPoints,
            dstPoints
        );

        result = new cv.Mat();

        cv.warpPerspective(
            source,
            result,
            matrix,
            new cv.Size(width, height),
            cv.INTER_CUBIC,
            cv.BORDER_CONSTANT,
            new cv.Scalar(0, 0, 0, 0)
        );

        // ==========================================
        // 4. VESUBIA HD
        // ==========================================

        enhanced = new cv.Mat();
        blurredImage = new cv.Mat();

        result.convertTo(
            enhanced,
            -1,
            1.08,
            5
        );

        cv.GaussianBlur(
            enhanced,
            blurredImage,
            new cv.Size(0, 0),
            1.2
        );

        cv.addWeighted(
            enhanced,
            1.2,
            blurredImage,
            -0.2,
            0,
            enhanced
        );

        // ==========================================
        // 5. COINS ARRONDIS
        // ==========================================

        const output = document.createElement("canvas");
        output.width = width;
        output.height = height;

        cv.imshow(output, enhanced);

        const ctx = output.getContext("2d");
        const radius = 28;

        ctx.globalCompositeOperation = "destination-in";

        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(
            width,
            height,
            width - radius,
            height
        );
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.globalCompositeOperation = "source-over";

        // ==========================================
        // 6. EXPORT PNG
        // ==========================================

        const finalBlob = await new Promise(resolve => {
            output.toBlob(resolve, "image/png");
        });

        if (!finalBlob) {
            throw new Error("Impossible de créer l'image finale.");
        }

        return new File(
            [finalBlob],
            "vesubia-scan.png",
            { type: "image/png" }
        );

    } finally {

        // ==========================================
        // 7. LIBÉRATION MÉMOIRE
        // ==========================================

        source.delete();

        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (edges) edges.delete();
        if (dilated) dilated.delete();
        if (kernel) kernel.delete();
        if (contours) contours.delete();
        if (hierarchy) hierarchy.delete();
        if (result) result.delete();
        if (enhanced) enhanced.delete();
        if (blurredImage) blurredImage.delete();
        if (srcPoints) srcPoints.delete();
        if (dstPoints) dstPoints.delete();
        if (matrix) matrix.delete();
    }
};
