// Variables pour l'interface graphique
let duelChart = null;
const video = document.getElementById('camera-preview');
const canvas = document.getElementById('capture-canvas');
const ctx = canvas.getContext('2d');
const scanStatus = document.getElementById('scan-status');
const carTitle = document.getElementById('car-title');

// Stats de l'adversaire pré-enregistrées
// Format : [Puissance, Vitesse, Poids normalisé, Accélération normalisée]
const opponentData =;
// Fonction pour démarrer le flux vidéo de la caméra arrière
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
        });
        video.srcObject = stream;
        scanStatus.innerText = "Statut : Caméra connectée. Prêt à scanner !";
    } catch (err) {
        console.error("Erreur d'accès à la caméra :", err);
        scanStatus.innerText = "Erreur : Impossible d'activer la caméra.";
    }
}
// Fonction prenant une photo instantanée et l'analysant avec Tesseract
async function scanCard() {
    if (!video.videoWidth) {
        scanStatus.innerText = "Erreur : Caméra non prête.";
        return null;
    }

    // On adapte le canvas à la taille réelle de la vidéo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    scanStatus.innerText = "Statut : Lecture de la carte en cours...";

    try {
        // Tesseract analyse le canvas en français
        const result = await Tesseract.recognize(canvas, 'fra');
        return result.data.text;
    } catch (error) {
        console.error("Erreur d'analyse OCR :", error);
        scanStatus.innerText = "Erreur : Échec de la lecture de l'image.";
        return null;
    }
}
// Fonction de tri du texte brut reçu par l'OCR
function parseCarData(rawText) {
    const cleanText = rawText.toLowerCase().replace(/\s+/g, ' ');
    
    const carData = {
        name: "Modèle Inconnu",
        stats: { horsepower: 0, topSpeed: 0, weight: 0, acceleration: 0 }
    };

    // 1. Recherche du nom
    const nameMatch = rawText.match(/modèle\s*[:\s]*([^\n]+)/i) || rawText.match(/^([^\n]+)/);
    if (nameMatch && nameMatch) carData.name = nameMatch.trim();

    // 2. Recherche de la puissance (ex: 300 ch)
    const hpMatch = cleanText.match(/(\d+)\s*ch/) || cleanText.match(/ch\s*[:\s]*(\d+)/);
    if (hpMatch) carData.stats.horsepower = parseInt(hpMatch, 10);

    // 3. Recherche de la vitesse maximale (ex: 250 km/h)
    const speedMatch = cleanText.match(/(\d+)\s*km\/h/) || cleanText.match(/max\s*[:\s]*(\d+)/);
    if (speedMatch) carData.stats.topSpeed = parseInt(speedMatch, 10);

    // 4. Recherche du poids (ex: 1200 kg)
    const weightMatch = cleanText.match(/(\d+)\s*kg/) || cleanText.match(/poids\s*[:\s]*(\d+)/);
    if (weightMatch) carData.stats.weight = parseInt(weightMatch, 10);

    // 5. Recherche du 0-100 km/h (ex: 5.4 s)
    const accMatch = cleanText.match(/(\d+(?:[.,]\d+)?)\s*s(?:ec)?/) || cleanText.match(/0-100\s*[:\s]*(\d+(?:[.,]\d+)?)/);
    if (accMatch) carData.stats.acceleration = parseFloat(accMatch.replace(',', '.'));

    return carData;
}
// Fonction pour générer le graphique Radar initial
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
                    label: 'Joueur (En attente de scan)',
                    data:,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            scales: { r: { suggestedMin: 0, suggestedMax: 400 } }
        }
    });
}

// Fonction pour mettre à jour le graphique avec la nouvelle voiture
function updateChartWithScannedCar(carData) {
    if (!duelChart) return;

    // Harmonisation des échelles pour le graphique (ex: 1500kg -> 150, et 4.5s -> 45)
    const normalizedStats = [
        carData.stats.horsepower,
        carData.stats.topSpeed,
        carData.stats.weight / 10,
        carData.stats.acceleration * 10
    ];

    // On remplace le nom et les données du joueur (dataset numéro 1)
    duelChart.data.datasets.label = carData.name;
    duelChart.data.datasets.data = normalizedStats;
    
    // On demande à Chart.js de se redessiner
    duelChart.update();
}
// Lancement automatique au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
    startCamera();
    initDuelChart();
});

// Événement clic sur le bouton de capture
document.getElementById('btn-scan').addEventListener('click', async () => {
    const rawText = await scanCard();
    
    if (rawText) {
        const playerCar = parseCarData(rawText);
        
        // Sécurité si le scan n'a trouvé aucun chiffre
        if (playerCar.stats.horsepower === 0 && playerCar.stats.topSpeed === 0) {
            scanStatus.innerText = "Statut : Scan fini, mais illisible. Réessayez.";
            return;
        }

        // Envoi au graphique
        updateChartWithScannedCar(playerCar);
        
        // Mise à jour des textes
        scanStatus.innerText = "Statut : Graphique mis à jour !";
        carTitle.innerText = `Voiture : ${playerCar.name}`;
    }
});
