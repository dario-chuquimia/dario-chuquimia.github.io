const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_STATE = {
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

let gameState = GAME_STATE.PLAYING;
let score = 0;
let lives = 3;

// Images
const images = {};
const imageSources = {
    player: 'player_ship.png',
    enemy: 'enemy_ship.png',
    bullet: 'bullet.png',
    enemyBullet: 'enemy_bullet.png',
    powerupRapid: 'powerup_rapid.png',
    powerupShield: 'powerup_shield.png'
};

// Player
const player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 80,
    width: 50,
    height: 50,
    speed: 5,
    powerup: null,
    powerupTimer: 0
};

// Bullets
let bullets = [];
let enemyBullets = [];

// Enemies
let enemies = [];
let enemyRows = 5;
let enemyCols = 8;
let enemySpeed = 1;
let enemyDirection = 1;
let enemiesThatCanShoot = [];

// Power-ups
let powerups = [];

// Particles
let particles = [];

// Controls
const keys = {};
let lastShotTime = 0; // Add this variable to track last shot

// Load images
function loadImages() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalImages = Object.keys(imageSources).length;
        
        for (const [key, src] of Object.entries(imageSources)) {
            images[key] = new Image();
            images[key].onload = () => {
                loadedCount++;
                if (loadedCount === totalImages) resolve();
            };
            images[key].src = src;
        }
    });
}

// Initialize enemies
function initEnemies() {
    enemies = [];
    enemiesThatCanShoot = [];
    for (let row = 0; row < enemyRows; row++) {
        for (let col = 0; col < enemyCols; col++) {
            const enemy = {
                x: col * 80 + 100,
                y: row * 60 + 50,
                width: 40,
                height: 40,
                alive: true,
                shootTimer: Math.random() * 2000,
                lastShot: 0,
                canShoot: false
            };
            enemies.push(enemy);
            
            // Select random enemies that can shoot (max 10)
            if (Math.random() < 0.3 && enemiesThatCanShoot.length < 10) {
                enemy.canShoot = true;
                enemiesThatCanShoot.push(enemy);
            }
        }
    }
    
    // Ensure we have exactly 10 shooting enemies
    while (enemiesThatCanShoot.length < 10 && enemiesThatCanShoot.length < enemies.filter(e => e.alive).length) {
        const aliveEnemies = enemies.filter(e => e.alive && !e.canShoot);
        if (aliveEnemies.length > 0) {
            const randomEnemy = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            randomEnemy.canShoot = true;
            enemiesThatCanShoot.push(randomEnemy);
        }
    }
}

// Event listeners
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'KeyP') {
        togglePause();
    }
    
    // Individual shot on space press
    if (e.code === 'Space' && gameState === GAME_STATE.PLAYING) {
        const currentTime = Date.now();
        if (currentTime - lastShotTime > 200) { // 200ms cooldown between shots
            shoot();
            lastShotTime = currentTime;
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function togglePause() {
    if (gameState === GAME_STATE.PLAYING) {
        gameState = GAME_STATE.PAUSED;
        document.getElementById('pauseMenu').style.display = 'block';
    } else if (gameState === GAME_STATE.PAUSED) {
        gameState = GAME_STATE.PLAYING;
        document.getElementById('pauseMenu').style.display = 'none';
    }
}

function update() {
    if (gameState !== GAME_STATE.PLAYING) return;

    // Player movement
    if (keys['ArrowLeft'] && player.x > 0) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }

    // Update bullets
    bullets.forEach((bullet, index) => {
        bullet.y -= bullet.speed;
        if (bullet.y < 0) bullets.splice(index, 1);
    });

    // Update enemy bullets
    enemyBullets.forEach((bullet, index) => {
        bullet.y += bullet.speed;
        if (bullet.y > canvas.height) enemyBullets.splice(index, 1);
    });

    // Update enemies
    let moveDown = false;
    let newEnemiesThatCanShoot = [];
    
    enemies.forEach(enemy => {
        if (!enemy.alive) return;
        
        enemy.x += enemySpeed * enemyDirection;
        
        // Check boundaries
        if (enemy.x <= 0 || enemy.x >= canvas.width - enemy.width) {
            moveDown = true;
        }
        
        // Enemy shooting - only for selected shooting enemies
        if (enemy.canShoot && enemy.alive && Date.now() - enemy.lastShot > 2000) {
            if (Math.random() < 0.3) {
                enemyBullets.push({
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height,
                    width: 5,
                    height: 15,
                    speed: 3
                });
                enemy.lastShot = Date.now();
            }
        }
        
        if (enemy.alive && enemy.canShoot) {
            newEnemiesThatCanShoot.push(enemy);
        }
    });
    
    enemiesThatCanShoot = newEnemiesThatCanShoot;

    if (moveDown) {
        enemyDirection *= -1;
        enemies.forEach(enemy => {
            if (enemy.alive) {
                enemy.y += 30;
            }
        });
    }

    // Update power-ups
    powerups.forEach((powerup, index) => {
        powerup.y += 2;
        if (powerup.y > canvas.height) powerups.splice(index, 1);
    });

    // Update particles
    particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        if (particle.life <= 0) particles.splice(index, 1);
    });

    // Handle power-up timer
    if (player.powerupTimer > 0) {
        player.powerupTimer--;
        if (player.powerupTimer <= 0) {
            player.powerup = null;
            document.getElementById('powerups').textContent = 'Power-up: Ninguno';
        }
    }

    checkCollisions();
}

function shoot() {
    let maxBullets = 5;
    if (player.powerup === 'rapidfire') {
        maxBullets = 10; // Allow more bullets with rapid fire
    }
    
    if (bullets.length < maxBullets) {
        bullets.push({
            x: player.x + player.width / 2,
            y: player.y,
            width: 4,
            height: 15,
            speed: 8
        });
    }
}

function checkCollisions() {
    // Player bullets vs enemies
    bullets.forEach((bullet, bIndex) => {
        enemies.forEach((enemy, eIndex) => {
            if (enemy.alive &&
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                
                enemy.alive = false;
                bullets.splice(bIndex, 1);
                score += 100;
                
                // Create particles
                for (let i = 0; i < 10; i++) {
                    particles.push({
                        x: enemy.x + enemy.width / 2,
                        y: enemy.y + enemy.height / 2,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5,
                        life: 30,
                        color: '#ff00ff'
                    });
                }
                
                // Random power-up drop
                if (Math.random() < 0.1) {
                    powerups.push({
                        x: enemy.x,
                        y: enemy.y,
                        width: 30,
                        height: 30,
                        type: Math.random() < 0.5 ? 'rapidfire' : 'shield'
                    });
                }
            }
        });
    });

    // Player vs power-ups
    powerups.forEach((powerup, index) => {
        if (powerup.x < player.x + player.width &&
            powerup.x + powerup.width > player.x &&
            powerup.y < player.y + player.height &&
            powerup.y + powerup.height > player.y) {
            
            player.powerup = powerup.type;
            player.powerupTimer = 300; // 5 seconds at 60fps
            powerups.splice(index, 1);
            
            document.getElementById('powerups').textContent = `Power-up: ${powerup.type.toUpperCase()}`;
        }
    });

    // Enemy bullets vs player - CHECK SHIELD FIRST
    enemyBullets.forEach((bullet, index) => {
        if (bullet.x < player.x + player.width &&
            bullet.x + bullet.width > player.x &&
            bullet.y < player.y + player.height &&
            bullet.y + bullet.height > player.y) {
            
            // If player has shield, block the bullet
            if (player.powerup === 'shield') {
                enemyBullets.splice(index, 1);
                return; // Don't take damage, shield protects
            }
            
            enemyBullets.splice(index, 1);
            lives--;
            
            if (lives <= 0) {
                gameState = GAME_STATE.GAME_OVER;
                document.getElementById('gameOver').style.display = 'block';
                document.getElementById('finalScore').textContent = score;
            }
        }
    });

    // Check if all enemies are defeated
    if (enemies.every(enemy => !enemy.alive)) {
        initEnemies();
        enemySpeed += 0.5;
    }
}

function draw() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    for (let i = 0; i < 100; i++) {
        const x = (Date.now() * 0.01 + i * 100) % canvas.width;
        const y = (Date.now() * 0.005 + i * 50) % canvas.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(x, y, 1, 1);
    }

    // Draw player
    if (images.player) {
        ctx.drawImage(images.player, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = player.powerup ? '#00ffff' : '#ffffff';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
    
    // Draw player shield if active
    if (player.powerup === 'shield') {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, 35, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw enemies
    enemies.forEach(enemy => {
        if (enemy.alive) {
            if (images.enemy) {
                ctx.drawImage(images.enemy, enemy.x, enemy.y, enemy.width, enemy.height);
            } else {
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            }
        }
    });

    // Draw bullets
    bullets.forEach(bullet => {
        if (images.bullet) {
            ctx.drawImage(images.bullet, bullet.x - 2, bullet.y, 8, 15);
        } else {
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }
    });

    // Draw enemy bullets
    enemyBullets.forEach(bullet => {
        if (images.enemyBullet) {
            ctx.drawImage(images.enemyBullet, bullet.x - 2, bullet.y, 8, 15);
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        }
    });

    // Draw power-ups with images
    powerups.forEach(powerup => {
        if (powerup.type === 'rapidfire' && images.powerupRapid) {
            ctx.drawImage(images.powerupRapid, powerup.x, powerup.y, powerup.width, powerup.height);
        } else if (powerup.type === 'shield' && images.powerupShield) {
            ctx.drawImage(images.powerupShield, powerup.x, powerup.y, powerup.width, powerup.height);
        } else {
            ctx.fillStyle = powerup.type === 'rapidfire' ? '#ffff00' : '#00ffff';
            ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
        }
    });

    // Draw particles
    particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life / 30;
        ctx.fillRect(particle.x, particle.y, 3, 3);
    });
    ctx.globalAlpha = 1;

    // Update UI
    document.getElementById('score').textContent = `Puntuación: ${score}`;
    document.getElementById('lives').textContent = `Vidas: ${lives}`;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Initialize and start
loadImages().then(() => {
    initEnemies();
    gameLoop();
});