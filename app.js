// ==========================================
// 1. INITIALISATION & VARIABLES GLOBALES
// ==========================================
let duelChart = null;
const video = document.getElementById('camera-preview');
const canvas = document.getElementById('capture-canvas');
const ctx = canvas.getContext('2d');
const scanStatus = document.getElementById('scan-status');
const carTitle = document.getElementById('car-title');

// Stats de l'adversaire pré-enregistrées (Aucune case vide)
const opponentData = [320, 290, 145, 42]; 

// ==========================================
// 2. CONTRÔLE DE LA CAMÉRA FLUX VIDÉO
// ==========================================
async function startCamera() {
    try {
        console.log("Tentative de démarrage caméra...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        video.srcObject = stream;
        scanStatus.innerText = "Statut : Caméra active. Alignez votre carte.";
    } catch (err) {
        console.error("Erreur d'accès à la caméra :", err);
        scanStatus.innerText = "Erreur : " + err.message;
    }
}

// ==========================================
// 3. CAPTURE IMAGE & MOTEUR OCR (TESSERACT)
// ==========================================
async function scanCard() {
    if (!video.videoWidth) {
        scanStatus.innerText = "Erreur : Flux vidéo indisponible.";
        return null;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    scanStatus.innerText = "Statut : Analyse OCR en cours...";

    try {
        const result = await Tesseract.recognize(canvas, 'fra');
        return result.data.text;
    } catch (error) {
        console.error("Erreur Tesseract OCR :", error);
        scanStatus.innerText = "Erreur : Échec de la lecture optique.";
        return null;
    }
}

// ==========================================
// 4. MOTEUR DE PARSING ET REGEX
// ==========================================
function parseCarData(rawText) {
    const cleanText = rawText.toLowerCase().replace(/\s+/g, ' ');
    
    const carData = {
        name: "Modèle Inconnu",
        stats: { horsepower: 0, topSpeed: 0, weight: 0, acceleration: 0 }
    };

    const nameMatch = rawText.match(/modèle\s*[:\s]*([^\n]+)/i) || rawText.match(/^([^\n]+)/);
    if (nameMatch) {
        carData.name = nameMatch[0].trim();
    }

    const hpMatch = cleanText.match(/(\d+)\s*ch/) || cleanText.match(/ch\s*[:\s]*(\d+)/);
    if (hpMatch) carData.stats.horsepower = parseInt(hpMatch[1], 10);

    const speedMatch = cleanText.match(/(\d+)\s*km\/h/) || cleanText.match(/max\s*[:\s]*(\d+)/);
    if (speedMatch) carData.stats.topSpeed = parseInt(speedMatch[1], 10);

    const weightMatch = cleanText.match(/(\d+)\s*kg/) || cleanText.match(/poids\s*[:\s]*(\d+)/);
    if (weightMatch) carData.stats.weight = parseInt(weightMatch[1], 10);

    const accMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*s(?:ec)?/) || cleanText.match(/0-100\s*[:\s]*(\d+(?:[.,]\d+)?)/);
    if (accMatch) {
        carData.stats.acceleration = parseFloat(accMatch[1].replace(',', '.'));
    }

    return carData;
}

// ==========================================
// 5. INTÉGRATION ET RENDU CHART.JS (RADAR)
// ==========================================
function initDuelChart() {
    const chartCtx = document.getElementById('duelChart').getContext('2d');
    
    duelChart = new Chart(chartCtx, {
        type: 'radar',
        data: {
            labels: ['Puissance (Ch)', 'Vitesse Max (km/h)', 'Poids (kg / 10)', '0-100 km/h (s x 10)'],
            datasets: [
                {
                    label: 'Adversaire (IA)',
                    data: opponentData,
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 2
                },
                {
                    label: 'Joueur (En attente...)',
                    data: [0, 0, 0, 0], // Tableau initialisé proprement sans valeurs vides
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    suggestedMin: 0,
                    suggestedMax: 400
                }
            }
        }
    });
}

function updateChartWithScannedCar(carData) {
    if (!duelChart) return;

    const normalizedStats = [
        carData.stats.horsepower,
        carData.stats.topSpeed,
        carData.stats.weight / 10,       
        carData.stats.acceleration * 10   
    ];

    // Correction des index cibles du dataset Joueur (index 1)
    duelChart.data.datasets[1].label = carData.name;
    duelChart.data.datasets[1].data = normalizedStats;
    
    duelChart.update();
}

// ==========================================
// 6. ÉVÉNEMENTS & ÉCOUTEURS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    initDuelChart(); // On lance d'abord le graphique
    startCamera();   // Puis on appelle la caméra
});

document.getElementById('btn-scan').addEventListener('click', async () => {
    const rawText = await scanCard();
    if (rawText) {
        const playerCar = parseCarData(rawText);
        if (playerCar.stats.horsepower === 0 && playerCar.stats.topSpeed === 0) {
            scanStatus.innerText = "Statut : Carte illisible.";
            return;
        }
        updateChartWithScannedCar(playerCar);
        scanStatus.innerText = "Statut : Graphique mis à jour !";
        carTitle.innerText = `Voiture scannée : ${playerCar.name}`;
    }
});
