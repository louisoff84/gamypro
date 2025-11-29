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
controls.enableDamping = true;

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

// --- SYSTÈME DE JEU : PV, ARMES, SOIN ---

const GameState = {
    // État du Joueur
    maxHealth: 100,
    currentHealth: 100,
    weapon: 'Pickaxe', // Arme actuelle
    canShoot: true, // Contrôle le temps de rechargement
    healCooldown: false, // Contrôle le temps de recharge du soin

    // Modes de Construction
    isBuilding: false,
    buildMode: 'Wall', // Wall, Floor, Cone (seulement Wall sera implémenté ici)
    buildMaterial: new THREE.MeshStandardMaterial({ 
        color: 0xAAAAAA, 
        transparent: true, 
        opacity: 0.8 
    }),
};

// --- Initialisation de l'UI (Affichage tête haute) ---
const uiContainer = document.createElement('div');
uiContainer.style.cssText = `
    position: absolute;
    top: 10px;
    left: 10px;
    color: white;
    font-family: sans-serif;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 8px;
    z-index: 10;
`;
document.body.appendChild(uiContainer);

const healthDisplay = document.createElement('div');
healthDisplay.id = 'healthDisplay';
uiContainer.appendChild(healthDisplay);

const weaponDisplay = document.createElement('div');
weaponDisplay.id = 'weaponDisplay';
uiContainer.appendChild(weaponDisplay);

const modeDisplay = document.createElement('div');
modeDisplay.id = 'modeDisplay';
uiContainer.appendChild(modeDisplay);


/**
 * Met à jour l'affichage des PV et des armes.
 */
function updateUI() {
    healthDisplay.innerHTML = `❤️ HP: ${GameState.currentHealth}/${GameState.maxHealth}`;
    weaponDisplay.innerHTML = `🔫 Arme: ${GameState.weapon} | Cooldown: ${GameState.canShoot ? 'Prêt' : 'Recharge'}`;
    modeDisplay.innerHTML = `🔨 Mode: ${GameState.isBuilding ? `Construction (${GameState.buildMode})` : 'Combat'}`;
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
    if (GameState.healCooldown || GameState.currentHealth >= GameState.maxHealth) return;
    
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
    // Le vecteur de tir est toujours le centre (0, 0)
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    // Objets qu'on peut cibler (tous les murs construits)
    const intersects = raycaster.intersectObjects(builtObjects, true);

    if (GameState.weapon === 'Pickaxe') {
        if (intersects.length > 0) {
            // Un mur est touché, on simule l'édition (destruction)
            const objectHit = intersects[0].object;
            destroyBuild(objectHit);
            console.log("Pioche: Mur détruit.");
        } else {
            console.log("Pioche: Coup dans le vide.");
        }
    } else {
        // Logique de tir d'arme (simulé)
        if (intersects.length > 0) {
            console.log(`Tir de ${GameState.weapon}: Touche un mur.`);
            // Si c'était un autre joueur, on lui enverrait les dégâts ici
        } else {
            console.log(`Tir de ${GameState.weapon}: Manqué.`);
        }
    }

    updateUI();
}

/**
 * Change l'arme actuelle.
 * @param {string} newWeapon - Le nom de la nouvelle arme.
 */
function changeWeapon(newWeapon) {
    GameState.weapon = newWeapon;
    console.log(`Arme changée: ${newWeapon}`);
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
        // Le mur fait GRID_SIZE de haut, donc sa base est y=0 et son centre y=GRID_SIZE/2
        const y = GRID_SIZE / 2; 

        // Crée une clé unique pour vérifier si un mur existe déjà
        const key = `${x}:${y}:${z}`;
        
        return { x, y, z, key };
    }
    return null;
}

/**
 * Ajoute un mur simple à la scène.
 */
function createWall() {
    const buildPos = getBuildPosition();
    if (!buildPos) return;

    if (buildMap.has(buildPos.key)) {
        console.log("Un mur existe déjà à cette position.");
        return;
    }

    // Géométrie et Matériau du mur
    const wallGeometry = new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, 0.5); // Mur fin
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x795548 }); // Marron (bois)
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    
    wall.position.set(buildPos.x, buildPos.y, buildPos.z);
    wall.userData.key = buildPos.key; // Stocke la clé pour la map
    
    scene.add(wall);
    builtObjects.push(wall);
    buildMap.set(buildPos.key, wall);
    
    console.log(`Mur construit à ${buildPos.key}`);
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
        console.log(`Mur détruit à ${object.userData.key}`);
    }
}

/**
 * Active/désactive le mode de construction.
 */
function toggleBuildMode() {
    GameState.isBuilding = !GameState.isBuilding;
    console.log(`Mode de construction: ${GameState.isBuilding ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    updateUI();
}

/**
 * Édition (Détruire) - Géré par l'action primaire en mode 'Pickaxe'.
 */
function editAction() {
    if (GameState.isBuilding) {
        // En mode construction, l'action primaire (clic gauche) est 'Build'
        createWall();
    } else {
        // En mode combat, l'action primaire est 'Shoot' / 'Pickaxe'
        primaryAction();
    }
}


// --- GESTIONNAIRE D'ÉVÉNEMENTS CLAVIER ET SOURIS ---

/**
 * Gère les raccourcis clavier pour les systèmes de jeu.
 * @param {KeyboardEvent} event - L'événement du clavier.
 */
function handleInput(event) {
    const key = event.key;

    // 1. Gestion des Armes (1, 2, 3)
    if (key === '1') changeWeapon('Pickaxe');
    else if (key === '2') changeWeapon('Assault Rifle');
    else if (key === '3') changeWeapon('Shotgun');

    // 2. Gestion du Soin (H ou 4)
    else if (key === 'h' || key === 'H' || key === '4') {
        heal(25); // Soigne 25 PV
    }

    // 3. Gestion de la Construction (Q/E ou F)
    else if (key === 'q' || key === 'Q') toggleBuildMode();
    
    // 4. Test de Dégâts (T)
    else if (key === 't' || key === 'T') takeDamage(10); // Pour tester la barre de PV
}

// L'action principale (simulée par la touche Espace)
document.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
        editAction(); // Utilise l'action primaire (Build ou Shoot/Edit)
    }
    handleInput(event);
});

// Le clic gauche peut aussi déclencher l'action primaire (tir/construction)
document.addEventListener('click', editAction); 


// --- INITIALISATION DE LA SCÈNE ET BOUCLE D'ANIMATION ---

// 1. Création du Sol
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// 2. Initialisation et Lancement de la boucle
updateUI(); // Affiche l'état initial
animate();

// 3. Boucle d'animation (restée simple)
function animate() {
    requestAnimationFrame(animate); 

    // Met à jour les contrôles
    controls.update(); 

    // Rend la scène visible
    renderer.render(scene, camera);
}

// 4. Gestion du Redimensionnement
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
