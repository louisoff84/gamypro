// Les variables THREE doivent être déclarées sans 'const' ou 'let' 
// si elles sont utilisées dans des fonctions appelées par la fenêtre (comme animate)
// mais ici, on utilise des références directes, donc 'const' convient.

// --- 1. CONFIGURATION DE BASE ---

// La SCÈNE : Contient tous les objets, lumières, et caméras.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3399FF); // Ciel bleu vif (style Fortnite)

// La CAMÉRA : Notre point de vue dans la scène.
// Le 75 est le champ de vision (FOV), les deux dernières valeurs sont le near/far clipping plane.
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15); // Place la caméra légèrement en hauteur

// Le RENDERER : Le moteur qui dessine la scène.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// L'élément canvas est créé par le renderer et sera ajouté au body par l'HTML
// (dans ce cas, le script est exécuté après le chargement du body)

// Les Contrôles de la Caméra (permet de bouger la souris pour inspecter la scène)
// NOTE : OrbitControls est disponible car nous l'avons chargé via un CDN dans l'HTML.
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Pour un mouvement plus fluide

// --- 2. LUMIÈRES ---

// Lumière Ambiante (éclaire uniformément sans ombres)
const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5); 
scene.add(ambientLight);

// Lumière Directionnelle (simule le soleil, crée des ombres)
const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1.5);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// --- 3. GÉOMÉTRIES ET MATÉRIAUX (Les Objets) ---

// Création du Sol
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50 }); // Vert herbe
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2; // Le plan doit être tourné pour être horizontal
scene.add(ground);

// Création d'un Cube (élément de construction/décor)
const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xFF5722 }); // Orange vif
const box = new THREE.Mesh(boxGeometry, boxMaterial);
box.position.y = 2; // Le place au-dessus du sol (taille 4/2 = 2)
box.position.z = -5;
scene.add(box);

// --- 4. LA BOUCLE D'ANIMATION ---

/**
 * La fonction qui s'appelle en continu pour redessiner la scène.
 */
function animate() {
    // requestAnimationFrame est la méthode préférée pour les animations du navigateur.
    requestAnimationFrame(animate); 

    // Mouvement simple du cube (animation de rotation)
    box.rotation.x += 0.005;
    box.rotation.y += 0.005;

    // Met à jour les contrôles (rotation de la caméra par l'utilisateur)
    controls.update(); 

    // Rend la scène visible
    renderer.render(scene, camera);
}

// --- 5. GESTION DU REDIMENSIONNEMENT ---

// Ajuste la caméra et le rendu si la fenêtre est redimensionnée
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Ajoute le canvas créé par le renderer au corps du document.
document.body.appendChild(renderer.domElement);

// Lance la boucle de jeu
animate();
