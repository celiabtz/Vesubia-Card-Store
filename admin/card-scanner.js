/* ==========================================
   VESUBIA DIGITAL SCAN — V5
   Détection multi-méthodes + perspective
========================================== */

(() => {
    "use strict";

    function waitForOpenCV() {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            function check() {
                if (window.cv && window.cv.Mat) {
                    resolve({ cv: window.cv });
                    return;
                }

                attempts++;

                if (attempts > 150) {
                    reject(new Error("OpenCV n'a pas réussi à se charger."));
                    return;
                }

                setTimeout(check, 200);
            }

            check();
        });
    }

    function loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Impossible de lire la photographie."));
            };

            img.src = url;
        });
    }

    function distance(a, b) {
        return Math.hypot(b.x - a.x, b.y - a.y);
    }

    function orderCorners(points) {
        const sum = points.map(p => p.x + p.y);
        const diff = points.map(p => p.y - p.x);

        return [
            points[sum.indexOf(Math.min(...sum))],
            points[diff.indexOf(Math.min(...diff))],
            points[sum.indexOf(Math.max(...sum))],
            points[diff.indexOf(Math.max(...diff))]
        ];
    }

    function expandCorners(points, factor = 1.012) {
        const center = {
            x: points.reduce((s, p) => s + p.x, 0) / 4,
            y: points.reduce((s, p) => s + p.y, 0) / 4
        };

        return points.map(p => ({
            x: center.x + (p.x - center.x) * factor,
            y: center.y + (p.y - center.y) * factor
        }));
    }

    function getCardRatio(corners) {
        const width = (
            distance(corners[0], corners[1]) +
            distance(corners[3], corners[2])
        ) / 2;

        const height = (
            distance(corners[0], corners[3]) +
            distance(corners[1], corners[2])
        ) / 2;

        if (!width || !height) return null;

        return height / width;
    }

    function findBestQuadrilateral(cv, contours, imageArea) {
        let bestCorners = null;
        let bestScore = -Infinity;

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);

            try {
                const area = cv.contourArea(contour);

                if (
                    area < imageArea * 0.03 ||
                    area > imageArea * 0.98
                ) {
                    continue;
                }

                const perimeter = cv.arcLength(contour, true);

                if (!perimeter) continue;

                const factors = [
                    0.008,
                    0.01,
                    0.012,
                    0.015,
                    0.02,
                    0.025,
                    0.03,
                    0.04,
                    0.05,
                    0.06
                ];

                for (const factor of factors) {
                    const approx = new cv.Mat();

                    try {
                        cv.approxPolyDP(
                            contour,
                            approx,
                            perimeter * factor,
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

                        const corners = orderCorners(points);
                        const ratio = getCardRatio(corners);

                        if (
                            !ratio ||
                            ratio < 1.20 ||
                            ratio > 1.60
                        ) {
                            continue;
                        }

                        const cardWidth = (
                            distance(corners[0], corners[1]) +
                            distance(corners[3], corners[2])
                        ) / 2;

                        const cardHeight = (
                            distance(corners[0], corners[3]) +
                            distance(corners[1], corners[2])
                        ) / 2;

                        if (
                            cardWidth < 50 ||
                            cardHeight < 70
                        ) {
                            continue;
                        }

                        const ratioScore =
                            1 - Math.abs(ratio - 1.40) / 0.20;

                        const areaScore = area / imageArea;

                        // Favorise les cartes assez grandes
                        // et proches du ratio attendu.
                        const score =
                            ratioScore * 5 +
                            areaScore * 2;

                        if (score > bestScore) {
                            bestScore = score;
                            bestCorners = corners;
                        }

                    } finally {
                        approx.delete();
                    }
                }

            } finally {
                contour.delete();
            }
        }

        return bestCorners;
    }

    function detectFromEdges(cv, src, imageArea, low, high) {
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const edges = new cv.Mat();
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();

        let kernel = null;

        try {
            cv.cvtColor(
                src,
                gray,
                cv.COLOR_RGBA2GRAY
            );

            cv.GaussianBlur(
                gray,
                blurred,
                new cv.Size(5, 5),
                0
            );

            cv.Canny(
                blurred,
                edges,
                low,
                high
            );

            kernel = cv.getStructuringElement(
                cv.MORPH_RECT,
                new cv.Size(5, 5)
            );

            cv.dilate(
                edges,
                edges,
                kernel
            );

            cv.findContours(
                edges,
                contours,
                hierarchy,
                cv.RETR_LIST,
                cv.CHAIN_APPROX_SIMPLE
            );

            return findBestQuadrilateral(
                cv,
                contours,
                imageArea
            );

        } finally {
            gray.delete();
            blurred.delete();
            edges.delete();
            contours.delete();
            hierarchy.delete();

            if (kernel) kernel.delete();
        }
    }

    function detectFromThreshold(cv, src, imageArea, thresholdMode) {
        const gray = new cv.Mat();
        const thresholded = new cv.Mat();
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();

        try {
            cv.cvtColor(
                src,
                gray,
                cv.COLOR_RGBA2GRAY
            );

            if (thresholdMode === "otsu") {
                cv.threshold(
                    gray,
                    thresholded,
                    0,
                    255,
                    cv.THRESH_BINARY + cv.THRESH_OTSU
                );
            } else {
                cv.adaptiveThreshold(
                    gray,
                    thresholded,
                    255,
                    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
                    cv.THRESH_BINARY,
                    11,
                    2
                );
            }

            cv.findContours(
                thresholded,
                contours,
                hierarchy,
                cv.RETR_LIST,
                cv.CHAIN_APPROX_SIMPLE
            );

            return findBestQuadrilateral(
                cv,
                contours,
                imageArea
            );

        } finally {
            gray.delete();
            thresholded.delete();
            contours.delete();
            hierarchy.delete();
        }
    }

    async function scanPokemonCard(file) {
        if (!(file instanceof File)) {
            throw new Error("Fichier image invalide.");
        }

        const { cv } = await waitForOpenCV();
        const img = await loadImage(file);

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext("2d", {
            willReadFrequently: true
        });

        ctx.drawImage(img, 0, 0);

        const src = cv.imread(canvas);
        let bestCorners = null;

        try {
            const imageArea = src.cols * src.rows;

            // ==================================
            // 1. MULTIPLE CANNY
            // ==================================

            const edgeSettings = [
                [20, 80],
                [30, 120],
                [50, 150],
                [15, 60]
            ];

            for (const [low, high] of edgeSettings) {
                bestCorners = detectFromEdges(
                    cv,
                    src,
                    imageArea,
                    low,
                    high
                );

                if (bestCorners) break;
            }

            // ==================================
            // 2. THRESHOLD OTSU
            // ==================================

            if (!bestCorners) {
                bestCorners = detectFromThreshold(
                    cv,
                    src,
                    imageArea,
                    "otsu"
                );
            }

            // ==================================
            // 3. THRESHOLD ADAPTATIF
            // ==================================

            if (!bestCorners) {
                bestCorners = detectFromThreshold(
                    cv,
                    src,
                    imageArea,
                    "adaptive"
                );
            }

            // ==================================
            // 4. ÉCHEC
            // ==================================

            if (!bestCorners) {
                throw new Error(
                    "Carte non détectée. Essaie de photographier la carte avec davantage de contraste et de fond autour."
                );
            }

            // ==================================
            // 5. MARGE
            // ==================================

            const corners = expandCorners(
                bestCorners,
                1.012
            );

            // ==================================
            // 6. DIMENSIONS
            // ==================================

            const width = Math.round(Math.max(
                distance(corners[0], corners[1]),
                distance(corners[3], corners[2])
            ));

            const height = Math.round(Math.max(
                distance(corners[0], corners[3]),
                distance(corners[1], corners[2])
            ));

            // ==================================
            // 7. PERSPECTIVE
            // ==================================

            const dst = cv.matFromArray(
                4,
                1,
                cv.CV_32FC2,
                [
                    0, 0,
                    width, 0,
                    width, height,
                    0, height
                ]
            );

            const srcPoints = cv.matFromArray(
                4,
                1,
                cv.CV_32FC2,
                [
                    corners[0].x, corners[0].y,
                    corners[1].x, corners[1].y,
                    corners[2].x, corners[2].y,
                    corners[3].x, corners[3].y
                ]
            );

            const transform = cv.getPerspectiveTransform(
                srcPoints,
                dst
            );

            const result = new cv.Mat();

            try {
                cv.warpPerspective(
                    src,
                    result,
                    transform,
                    new cv.Size(width, height),
                    cv.INTER_LINEAR,
                    cv.BORDER_REPLICATE
                );

                const outputCanvas = document.createElement("canvas");
outputCanvas.width = width;
outputCanvas.height = height;

cv.imshow(outputCanvas, result);

const outputFile = await new Promise((resolve, reject) => {
    outputCanvas.toBlob(blob => {
        if (!blob) {
            reject(new Error("Impossible de générer l'image."));
            return;
        }

        resolve(
            new File(
                [blob],
                "vesubia-scan.jpg",
                { type: "image/jpeg" }
            )
        );
    }, "image/jpeg", 0.95);
});

return outputFile;
                return outputFile;

            } finally {
                dst.delete();
                srcPoints.delete();
                transform.delete();
                result.delete();
            }

        } finally {
            src.delete();
        }
    }

    window.scanPokemonCard = scanPokemonCard;

})();