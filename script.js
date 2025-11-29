// --- IMPORTATIONS (Simulées par l'environnement global Three.js) ---
// Three.js, OrbitControls sont disponibles globalement car chargés dans index.html.

// --- CONFIGURATION DE BASE DE LA SCÈNE ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3399FF); // Ciel bleu
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Permet à la souris de faire tourner la caméra pour l'inspection
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Gardé pour la rotation douce par la souris

// Lumières (restent les mêmes)
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5); 
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Liste des murs construits
const builtObjects = [];
// Map pour stocker les murs par leurs coordonnées (x:y:z)
const buildMap = new Map();
const GRID_SIZE = 4; // Taille des blocs de construction (doit correspondre au sol)
const BUILD_COST = 10; // Coût en ressources pour construire un mur

// --- CONFIGURATION DU MOUVEMENT ---
const MOVE_SPEED = 0.005; // Vitesse de base du mouvement (ajustée pour deltaTime)
const keyboardState = {}; // État des touches pressées (ZQSD)

// --- DÉFINITION DE L'INVENTAIRE ET DES SLOTS ---
const INVENTORY_SLOTS = [
    { type: 'Weapon', name: 'Pickaxe', icon: '⛏️' },
    { type: 'Weapon', name: 'Assault Rifle', icon: '🔫' },
    { type: 'Weapon', name: 'Shotgun', icon: '💣' },
    { type: 'Consumable', name: 'Medkit', icon: '🩹' },
    { type: 'Weapon', name: 'Reserve', icon: '🪖' }, // Slot 5 laissé pour d'autres armes
];

// NOUVEAU: Définition des pièces de construction avec leur coût et leur raccourci
const BUILD_PIECES = {
    'Wood Wall': { icon: '🧱', cost: 10, keyBind: 'x' },
    'Wood Floor': { icon: '🟩', cost: 10, keyBind: 'c' },
    'Wood Stair': { icon: '📐', cost: 10, keyBind: 'w' },
};

// --- SYSTÈME DE JEU : PV, ARMES, SOIN ---

const GameState = {
    // État du Joueur
    maxHealth: 100,
    currentHealth: 100,
    
    // Ressources et Inventaire
    resources: {
        Wood: 150, // Ressources initiales
        Stone: 50,
        Metal: 20
    },
    activeSlot: 0, // Slot actuellement sélectionné (0 à 4)
    activeBuildMode: null, // 'Wood Wall', 'Wood Floor', 'Wood Stair' ou null

    canShoot: true, // Contrôle le temps de rechargement
    healCooldown: false, // Contrôle le temps de recharge du soin
};
// L'arme actuelle est dérivée de l'activeSlot
Object.defineProperty(GameState, 'weapon', {
    get() {
        return INVENTORY_SLOTS[GameState.activeSlot].name;
    }
});


// --- SYSTÈME DE BOT ---
const BOT_HEALTH = 50;
const BOT_SPEED = 0.005; // Vitesse lente pour le test
let bot;
let lastMoveTime = 0;
const MOVE_INTERVAL = 3000; // Le bot change de direction toutes les 3 secondes

/**
 * Crée et place le bot sur la scène.
 */
function createBot() {
    const botGeometry = new THREE.BoxGeometry(GRID_SIZE * 0.8, GRID_SIZE * 1.5, GRID_SIZE * 0.8);
    const botMaterial = new THREE.MeshStandardMaterial({ color: 0xCC00FF }); // Violet vif pour le bot
    bot = new THREE.Mesh(botGeometry, botMaterial);
    
    // Position de départ loin du centre
    bot.position.set(20, (GRID_SIZE * 1.5) / 2, 20); 
    
    bot.userData.health = BOT_HEALTH;
    bot.userData.isBot = true; // Marqueur pour le raycasting
    bot.userData.moveDir = new THREE.Vector3(1, 0, 0); // Direction initiale
    scene.add(bot);
    console.log("Bot ajouté à la scène.");
}

/**
 * Gère les dégâts subis par un bot.
 */
function damageBot(botMesh, amount) {
    if (botMesh.userData.health <= 0) return;

    botMesh.userData.health -= amount;
    console.log(`Bot endommagé de -${amount}. PV restants: ${botMesh.userData.health}`);

    if (botMesh.userData.health <= 0) {
        scene.remove(botMesh);
        console.log("Bot détruit !");
        // On désactive le bot après sa destruction
        bot = null; 
    }
}

/**
 * Logique d'IA pour le Bot.
 * @param {number} deltaTime - Temps écoulé depuis la dernière frame.
 */
function updateBot(deltaTime) {
    if (!bot) return;

    const time = performance.now();
    const elapsedTime = time - lastMoveTime;

    // 1. Mouvement aléatoire simple
    if (elapsedTime > MOVE_INTERVAL) {
        // Choisir une nouvelle direction aléatoire
        const angle = Math.random() * Math.PI * 2;
        bot.userData.moveDir.set(Math.cos(angle), 0, Math.sin(angle));
        lastMoveTime = time;
    }

    // Déplacer le bot dans la direction choisie (vitesse constante)
    const moveStep = bot.userData.moveDir.clone().multiplyScalar(BOT_SPEED * deltaTime);
    bot.position.add(moveStep);

    // 2. Simuler l'attaque du bot (tirs aléatoires)
    if (Math.random() < 0.003) { // Petite chance de tirer à chaque frame
         // Le bot vous tire dessus !
         takeDamage(5); // Le bot vous inflige 5 points de dégâts
         console.log("Le Bot vous tire dessus (dégâts de test) !");
    }
}

/**
 * Gère le mouvement du joueur (caméra) basé sur ZQSD.
 * @param {number} deltaTime - Temps écoulé depuis la dernière frame.
 */
function updateMovement(deltaTime) {
    const moveVector = new THREE.Vector3(0, 0, 0);
    
    // Z: Avancer
    if (keyboardState['z']) {
        moveVector.z -= 1; 
    }
    // S: Reculer
    if (keyboardState['s']) {
        moveVector.z += 1; 
    }
    // Q: Gauche
    if (keyboardState['q']) {
        moveVector.x -= 1; 
    }
    // D: Droite
    if (keyboardState['d']) {
        moveVector.x += 1; 
    }

    if (moveVector.lengthSq() > 0) {
        // Normalise et applique la vitesse en fonction du temps
        moveVector.normalize().multiplyScalar(MOVE_SPEED * deltaTime);
        
        // Applique le mouvement à la caméra par rapport à sa direction (rotation)
        camera.translateX(moveVector.x);
        camera.translateZ(moveVector.z);

        // Optionnel : Maintient une hauteur constante (comme si on marchait)
        // camera.position.y = 5; 
    }
    
    // Met à jour les contrôles pour synchroniser la rotation de la souris
    controls.update();
}


// --- Initialisation de l'UI (Affichage tête haute - HUD) ---

// Conteneur général (Haut Gauche)
const uiContainer = document.createElement('div');
uiContainer.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    color: white;
    font-family: 'Inter', sans-serif;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;
document.body.appendChild(uiContainer);

// Éléments du HUD du Joueur (HP/Ressources)
const healthDisplay = document.createElement('div');
healthDisplay.id = 'healthDisplay';
healthDisplay.style.fontWeight = 'bold';
uiContainer.appendChild(healthDisplay);

const resourceDisplay = document.createElement('div');
resourceDisplay.id = 'resourceDisplay';
uiContainer.appendChild(resourceDisplay);

// Conteneur de l'Inventaire (Bas du centre)
const inventoryContainer = document.createElement('div');
inventoryContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 5px;
    z-index: 10;
`;
document.body.appendChild(inventoryContainer);

// NOUVEAU: Conteneur du Mode Construction (Bas Droite)
const buildContainer = document.createElement('div');
buildContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    right: 10px;
    display: flex;
    gap: 5px;
    z-index: 10;
`;
document.body.appendChild(buildContainer);


/**
 * Met à jour l'affichage des PV, des ressources et des slots.
 */
function updateUI() {
    // 1. Mise à jour HP
    healthDisplay.innerHTML = `❤️ HP: ${GameState.currentHealth}/${GameState.maxHealth}`;
    
    // 2. Mise à jour Ressources
    resourceDisplay.innerHTML = `
        Bois: ${GameState.resources.Wood} | 
        Pierre: ${GameState.resources.Stone} | 
        Métal: ${GameState.resources.Metal}
    `;

    // 3. Rendu de l'Inventaire (HUD du bas)
    renderInventoryHUD();
    
    // 4. Rendu du HUD de Construction
    renderBuildHUD();
}

/**
 * Dessine ou met à jour les 5 slots d'inventaire.
 */
function renderInventoryHUD() {
    // Nettoie l'ancien HUD
    inventoryContainer.innerHTML = ''; 

    INVENTORY_SLOTS.forEach((slot, index) => {
        const slotElement = document.createElement('div');
        const isSelected = index === GameState.activeSlot;

        slotElement.style.cssText = `
            width: 70px;
            height: 70px;
            background: ${isSelected ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'};
            border: 4px solid ${isSelected ? '#FFD700' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: ${isSelected ? 'black' : 'white'};
            font-size: 10px;
            transition: all 0.1s;
            cursor: pointer;
        `;
        
        // Numéro de slot (1, 2, 3...)
        const numberSpan = document.createElement('span');
        numberSpan.textContent = index + 1;
        numberSpan.style.position = 'absolute';
        numberSpan.style.top = '2px';
        numberSpan.style.left = '5px';
        numberSpan.style.fontWeight = 'bold';
        slotElement.appendChild(numberSpan);

        // Icône/Nom de l'objet
        const iconDiv = document.createElement('div');
        iconDiv.innerHTML = `<span style="font-size: 30px;">${slot.icon}</span>`;
        slotElement.appendChild(iconDiv);

        const nameDiv = document.createElement('div');
        nameDiv.textContent = slot.name.split(' ')[0];
        nameDiv.style.textAlign = 'center';
        nameDiv.style.marginTop = '2px';
        slotElement.appendChild(nameDiv);

        slotElement.onclick = () => setActiveSlot(index);

        inventoryContainer.appendChild(slotElement);
    });
}

/**
 * Dessine ou met à jour le HUD des raccourcis de construction (X, C, W).
 */
function renderBuildHUD() {
    buildContainer.innerHTML = '';

    Object.entries(BUILD_PIECES).forEach(([name, data]) => {
        const buildElement = document.createElement('div');
        const isSelected = GameState.activeBuildMode === name;

        buildElement.style.cssText = `
            width: 70px;
            height: 70px;
            background: ${isSelected ? 'rgba(0, 150, 255, 0.9)' : 'rgba(0, 0, 0, 0.7)'};
            border: 4px solid ${isSelected ? '#00FFFF' : 'rgba(255, 255, 255, 0.3)'};
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: ${isSelected ? 'white' : 'white'};
            font-size: 10px;
            transition: all 0.1s;
            cursor: pointer;
        `;
        
        // Keybind
        const keySpan = document.createElement('span');
        keySpan.textContent = data.keyBind.toUpperCase();
        keySpan.style.position = 'absolute';
        keySpan.style.top = '2px';
        keySpan.style.left = '5px';
        keySpan.style.fontWeight = 'bold';
        buildElement.appendChild(keySpan);

        // Icon
        const iconDiv = document.createElement('div');
        iconDiv.innerHTML = `<span style="font-size: 30px;">${data.icon}</span>`;
        buildElement.appendChild(iconDiv);

        // Name
        const nameDiv = document.createElement('div');
        nameDiv.textContent = name.split(' ')[1]; // Wall, Floor, Stair
        nameDiv.style.textAlign = 'center';
        nameDiv.style.marginTop = '2px';
        buildElement.appendChild(nameDiv);

        buildElement.onclick = () => selectBuildMode(name);

        buildContainer.appendChild(buildElement);
    });
}


/**
 * Gère les dégâts subis par le joueur.
 * @param {number} amount - Quantité de dégâts.
 */
function takeDamage(amount) {
    if (GameState.currentHealth <= 0) return;
    
    GameState.currentHealth -= amount;
    
    if (GameState.currentHealth < 0) {
        GameState.currentHealth = 0;
    }
    console.log(`Dégâts subis: -${amount}. PV restants: ${GameState.currentHealth}`);
    updateUI();

    if (GameState.currentHealth === 0) {
        console.log("GAME OVER!");
        // Ici, on pourrait arrêter la boucle d'animation et afficher un écran de fin.
    }
}

/**
 * Gère le soin du joueur.
 * @param {number} amount - Quantité de PV restaurés.
 */
function heal(amount) {
    // Vérifie si l'item est bien le Medkit (Slot 4) et si le cooldown est terminé
    const activeItem = INVENTORY_SLOTS[GameState.activeSlot];
    if (activeItem.name !== 'Medkit' || GameState.healCooldown || GameState.currentHealth >= GameState.maxHealth) return;
    
    GameState.currentHealth += amount;
    if (GameState.currentHealth > GameState.maxHealth) {
        GameState.currentHealth = GameState.maxHealth;
    }

    GameState.healCooldown = true;
    console.log(`Soigné: +${amount}. PV actuels: ${GameState.currentHealth}`);
    updateUI();

    // Démarre le cooldown de soin (ex: 5 secondes)
    setTimeout(() => {
        GameState.healCooldown = false;
        console.log("Soin de nouveau disponible.");
        updateUI();
    }, 5000);
}

// --- SYSTÈME D'ARMES ET DE TIR (Simulé) ---

/**
 * Exécute l'action de tir/coup de pioche.
 * Utilise le raycasting pour détecter un objet en face.
 */
function primaryAction() {
    const activeItem = INVENTORY_SLOTS[GameState.activeSlot];
    
    if (activeItem.type !== 'Weapon') {
        console.log("Action impossible: ce n'est pas une arme.");
        return;
    }
    
    if (!GameState.canShoot) {
        console.log(`${GameState.weapon} en rechargement...`);
        return;
    }

    // Démarre le cooldown
    GameState.canShoot = false;
    setTimeout(() => {
        GameState.canShoot = true;
        updateUI();
    }, 500); // 0.5 seconde de délai pour le tir/coup

    // Raycasting: Tirer un rayon depuis la caméra au centre de l'écran
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Objets qu'on peut cibler (tous les murs construits ET le bot)
    const objectsToIntersect = [...builtObjects];
    if (bot) objectsToIntersect.push(bot); // Ajoute le bot à la liste des cibles

    const intersects = raycaster.intersectObjects(objectsToIntersect, true);

    if (intersects.length > 0) {
        const objectHit = intersects[0].object;
        
        // Vérifie si l'objet touché est le bot
        if (objectHit.userData.isBot) {
            let damage = activeItem.name === 'Pickaxe' ? 10 : 35;
            damageBot(objectHit, damage); 
            console.log(`Tir de ${activeItem.name}: Touche le Bot. Dégâts: ${damage}`);
            updateUI();
            return; 
        }

        if (activeItem.name === 'Pickaxe') {
            // Un mur est touché, on simule l'édition (destruction)
            destroyBuild(objectHit);
            console.log("Pioche: Mur détruit.");
        } else {
            // Logique de tir d'arme (simulé)
            console.log(`Tir de ${activeItem.name}: Touche un mur.`);
        }
    } else {
        if (activeItem.name === 'Pickaxe') {
            console.log("Pioche: Coup dans le vide.");
        } else {
            console.log(`Tir de ${activeItem.name}: Manqué.`);
        }
    }

    updateUI();
}

/**
 * Sélectionne le slot d'inventaire actif.
 * @param {number} slotIndex - Index du slot (0 à 4).
 */
function setActiveSlot(slotIndex) {
    if (slotIndex >= 0 && slotIndex < INVENTORY_SLOTS.length) {
        GameState.activeSlot = slotIndex;
        GameState.activeBuildMode = null; // Désactive le mode construction
        
        const activeItem = INVENTORY_SLOTS[slotIndex];
        console.log(`Slot sélectionné : ${activeItem.name}`);
        
        updateUI();
    }
}

/**
 * Sélectionne le mode de construction actif (Mur, Sol, Escalier).
 * @param {string} buildType - Le type de pièce à construire.
 */
function selectBuildMode(buildType) {
    if (GameState.activeBuildMode === buildType) {
        // Désactive le mode si on appuie deux fois sur la même touche
        GameState.activeBuildMode = null; 
        console.log("Mode construction désactivé.");
    } else {
        GameState.activeBuildMode = buildType;
        // Optionnel: On peut aussi changer le slot actif pour un slot vide/par défaut
        // Mais nous laissons le slot d'arme/consommable actif pour le moment.
        console.log(`Mode construction activé : ${buildType}`);
    }
    updateUI();
}


// --- SYSTÈME DE CONSTRUCTION ET D'ÉDITION (BUILD/EDIT) ---

/**
 * Calcule la position sur la grille 3D la plus proche du centre de la caméra.
 * @returns {{x: number, y: number, z: number} | null} - Coordonnées du placement.
 */
function getBuildPosition() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    // Cibler uniquement le sol
    const intersects = raycaster.intersectObject(ground);

    if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point;
        
        // Calcule les coordonnées alignées sur la grille
        const x = Math.round(intersectionPoint.x / GRID_SIZE) * GRID_SIZE;
        const z = Math.round(intersectionPoint.z / GRID_SIZE) * GRID_SIZE;
        // Le mur fait GRID_SIZE de haut, donc son centre est à y=GRID_SIZE/2
        const y = GRID_SIZE / 2; 

        // Crée une clé unique pour vérifier si un mur existe déjà
        const key = `${x}:${y}:${z}`;
        
        return { x, y, z, key };
    }
    return null;
}

/**
 * Ajoute un élément de construction à la scène (Mur, Sol ou Escalier).
 * @param {string} buildType - Le type de pièce à construire.
 */
function createBuildPiece(buildType) {
    const resourceType = 'Wood'; // Utilise uniquement du bois pour la démo
    const buildData = BUILD_PIECES[buildType];
    const cost = buildData.cost;

    if (GameState.resources[resourceType] < cost) {
        console.log(`Construction impossible: Manque de ${resourceType}. (Besoin: ${cost}, Actuel: ${GameState.resources[resourceType]})`);
        return;
    }
    
    const buildPos = getBuildPosition();
    if (!buildPos) return;

    if (buildMap.has(buildPos.key)) {
        console.log("Une pièce existe déjà à cette position.");
        return;
    }

    let geometry, material, rotationY = 0;
    let finalY = buildPos.y; // Position Y par défaut (centre de la pièce)
    
    // Définition de la Géométrie selon le type
    if (buildType === 'Wood Wall') {
        geometry = new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, 0.5); 
        material = new THREE.MeshStandardMaterial({ color: 0x795548 }); // Marron (bois)
        
        // Calcule l'orientation du mur pour qu'il soit perpendiculaire au regard
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        // Utilise la direction Z pour déterminer la rotation (simplifié: 0 ou 90 degrés)
        rotationY = Math.abs(cameraDirection.z) > Math.abs(cameraDirection.x) ? 0 : Math.PI / 2;

    } else if (buildType === 'Wood Floor') {
        // Le sol est un plan posé sur le sol de la grille (y=0)
        geometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE); 
        material = new THREE.MeshStandardMaterial({ color: 0x8BC34A, side: THREE.DoubleSide }); // Vert clair (sol)
        finalY = 0; // Le sol est à y=0
    
    } else if (buildType === 'Wood Stair') {
        // Rampe/Escalier : un plan incliné
        geometry = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE * 1.414); // Longueur ajustée pour l'inclinaison
        material = new THREE.MeshStandardMaterial({ color: 0xFFA000, side: THREE.DoubleSide }); // Orange (rampe)
        
        // Calcule l'orientation de la rampe pour qu'elle soit devant le joueur
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        rotationY = Math.atan2(cameraDirection.x, cameraDirection.z);
        // Arrondi à l'angle le plus proche (0, 90, 180, 270 degrés)
        rotationY = Math.round(rotationY / (Math.PI / 2)) * (Math.PI / 2);
        
        // Incline la géométrie sur son axe X (45 degrés pour simuler la pente)
        geometry.rotateX(-Math.PI / 4);
        finalY = GRID_SIZE / 4; // Ajuste la hauteur pour que le point bas soit au niveau du sol
    }
    
    const piece = new THREE.Mesh(geometry, material);
    
    piece.position.set(buildPos.x, finalY, buildPos.z);
    
    // Rotation pour le sol (pour qu'il soit plat sur Y)
    if (buildType === 'Wood Floor') {
        piece.rotation.x = -Math.PI / 2; // Tourne sur l'axe X pour être horizontal
    } else if (buildType === 'Wood Wall') {
        piece.rotation.y = rotationY; // Orientation du mur
    } else if (buildType === 'Wood Stair') {
        // La rotationY a déjà été calculée ci-dessus
        piece.rotation.y = rotationY;
    }


    piece.userData.key = buildPos.key; 
    piece.userData.type = buildType; // Sauvegarde le type de construction
    
    scene.add(piece);
    builtObjects.push(piece);
    buildMap.set(buildPos.key, piece);

    // Consommation de ressources
    GameState.resources[resourceType] -= cost;
    
    console.log(`${buildType} construit à ${buildPos.key}. -${cost} ${resourceType}.`);
    updateUI(); // Met à jour l'affichage des ressources
}

/**
 * Détruit un objet de construction de la scène.
 * @param {THREE.Object3D} object - L'objet à détruire.
 */
function destroyBuild(object) {
    if (object.userData.key) {
        scene.remove(object);
        
        // Retire de la liste et de la map
        const index = builtObjects.indexOf(object);
        if (index > -1) {
            builtObjects.splice(index, 1);
        }
        buildMap.delete(object.userData.key);

        object.geometry.dispose();
        object.material.dispose();
        console.log(`Pièce détruite à ${object.userData.key}`);

        // Récupération de ressources simulée
        GameState.resources.Wood += Math.round(BUILD_COST * 0.75);
        updateUI();
    }
}

/**
 * Gère l'action du joueur (Tir, Soin ou Construction).
 */
function handlePrimaryAction() {
    if (GameState.activeBuildMode) {
        // Priorité à la construction si un mode est sélectionné
        createBuildPiece(GameState.activeBuildMode);
        return;
    }
    
    const activeItem = INVENTORY_SLOTS[GameState.activeSlot];
    
    if (activeItem.type === 'Weapon') {
        primaryAction();
    } else if (activeItem.name === 'Medkit') {
        heal(50); // Soigne 50 PV si on utilise le medkit
    } else {
        console.log("Action non définie pour cet emplacement.");
    }
}


// --- GESTIONNAIRE D'ÉVÉNEMENTS CLAVIER ET SOURIS ---

/**
 * Gère les raccourcis clavier pour les systèmes de jeu.
 * @param {KeyboardEvent} event - L'événement du clavier.
 */
function handleInput(event) {
    const key = event.key.toLowerCase();

    // 1. Sélection des Slots 1 à 5
    const slotIndex = parseInt(key, 10) - 1;
    if (slotIndex >= 0 && slotIndex < INVENTORY_SLOTS.length) {
        setActiveSlot(slotIndex);
        return; // Consomme l'événement
    }
    
    // 2. Sélection des Modes de Construction (X, C, W)
    if (key === BUILD_PIECES['Wood Wall'].keyBind) {
        selectBuildMode('Wood Wall');
    } else if (key === BUILD_PIECES['Wood Floor'].keyBind) {
        selectBuildMode('Wood Floor');
    } else if (key === BUILD_PIECES['Wood Stair'].keyBind) {
        selectBuildMode('Wood Stair');
    }

    // 3. Test de Dégâts (T)
    else if (key === 't') takeDamage(10); // Pour tester la barre de PV
}

// Listeners pour l'état des touches de mouvement (ZQSD) et l'action principale
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    
    // Touches de mouvement (ZQSD)
    if (['z', 'q', 's', 'd'].includes(key)) {
        keyboardState[key] = true;
    }
    
    // Touche Espace pour l'action principale
    if (event.key === ' ') {
        handlePrimaryAction(); 
        event.preventDefault(); // Empêche le défilement de la page avec Espace
    }
    
    handleInput(event);
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    
    // Touches de mouvement (ZQSD)
    if (['z', 'q', 's', 'd'].includes(key)) {
        keyboardState[key] = false;
    }
});

// Le clic gauche peut aussi déclencher l'action primaire (tir/construction/soin)
document.addEventListener('click', handlePrimaryAction); 


// --- INITIALISATION DE LA SCÈNE ET BOUCLE D'ANIMATION ---

// 1. Création du Sol
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 2. Création du Bot et Initialisation de l'UI
createBot();
// Initialise le slot 1 (Pioche) par défaut
setActiveSlot(0); 

// 3. Boucle d'animation
let prevTime = 0; // Temps de la frame précédente

function animate(time) {
    requestAnimationFrame(animate); 

    const deltaTime = time - prevTime; // Calcule le temps écoulé depuis la dernière frame
    prevTime = time; 

    // NOUVEAU: Mouvement du joueur (ZQSD)
    updateMovement(deltaTime); 

    // Met à jour la logique du Bot (mouvement et attaque)
    updateBot(deltaTime); 

    // Rend la scène visible
    renderer.render(scene, camera);
}

// 4. Gestion du Redimensionnement
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lance la boucle d'animation
animate(prevTime);
