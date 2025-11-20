// Screen management
let currentScreen = 'orientation';
const orientationScreen = document.getElementById('orientation-screen');
const mainContent = document.getElementById('main-content');

// Check orientation
function checkOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;
  return isLandscape;
}

// Show appropriate screen based on orientation
function updateScreen() {
  const isLandscape = checkOrientation();
  
  if (!isLandscape) {
    // Show orientation screen
    orientationScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
    currentScreen = 'orientation';
  } else {
    // In landscape mode - show DJ board
    orientationScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    currentScreen = 'main';
  }
}

// Listen for orientation changes
window.addEventListener('resize', () => {
  setTimeout(updateScreen, 100);
});

window.addEventListener('orientationchange', () => {
  setTimeout(updateScreen, 200);
});

// Check on load
window.addEventListener('load', () => {
  setTimeout(updateScreen, 100);
});

// Initialize on load
updateScreen();

// Audio context for better mobile performance
let audioContext = null;
let isAudioContextInitialized = false;

// Initialize audio context on first user interaction (required for mobile)
function initAudioContext() {
  if (isAudioContextInitialized) return;
  
  try {
    // Create AudioContext for better mobile audio handling
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    isAudioContextInitialized = true;
  } catch (e) {
    console.log('AudioContext not supported, using fallback');
  }
}

// Initialize audio on first touch/interaction
document.addEventListener('touchstart', initAudioContext, { once: true });
document.addEventListener('click', initAudioContext, { once: true });

// Sound management - create separate instances to prevent overlapping
const soundInstances = {
  'Beat 1': [],
  'Beat 2': [],
  'Bass': [],
  'Drum': []
};

// Create multiple instances for each sound to allow quick retriggering
function createSoundInstances(name, count = 3) {
  for (let i = 0; i < count; i++) {
    const audio = new Audio(`sounds/${name}.mp3`);
    audio.preload = 'auto';
    audio.volume = 0.7;
    audio.loop = true; // Loop while held down
    // Optimize for mobile
    audio.crossOrigin = 'anonymous';
    soundInstances[name].push(audio);
  }
}

// Create instances for button sounds
createSoundInstances('Beat 1');
createSoundInstances('Beat 2');
createSoundInstances('Bass');
createSoundInstances('Drum');

// Scratch sound instances for each turntable
const scratchSounds = {
  turntable1: null,
  turntable2: null
};

// Create scratch sound instances
function createScratchSound(id) {
  const sound = new Audio('sounds/scratch.mp3');
  sound.preload = 'auto';
  sound.volume = 0.7;
  sound.crossOrigin = 'anonymous';
  scratchSounds[`turntable${id}`] = sound;
  return sound;
}

// Turntable functionality
class Turntable {
  constructor(element, id) {
    this.element = element;
    this.plate = element.querySelector('.turntable-plate');
    this.id = id;
    this.isDragging = false;
    this.lastAngle = 0;
    this.rotation = 0;
    this.lastTime = 0;
    this.velocity = 0;
    this.isMoving = false; // Track if actually moving
    
    // Create scratch sound for this turntable
    this.scratchSound = createScratchSound(id);
    
    this.init();
  }

  init() {
    // Mouse events
    this.element.addEventListener('mousedown', this.startDrag.bind(this), { passive: false });
    document.addEventListener('mousemove', this.drag.bind(this), { passive: false });
    document.addEventListener('mouseup', this.endDrag.bind(this), { passive: false });
    
    // Touch support - optimized for mobile
    this.element.addEventListener('touchstart', this.startDragTouch.bind(this), { passive: false });
    document.addEventListener('touchmove', this.dragTouch.bind(this), { passive: false });
    document.addEventListener('touchend', this.endDrag.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.endDrag.bind(this), { passive: false });
    
    // Initialize audio context on first interaction
    initAudioContext();
  }

  getAngleFromEvent(event) {
    const rect = this.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches && event.touches[0] ? event.touches[0].clientY : 0);
    
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  }

  startDrag(event) {
    event.preventDefault();
    // Initialize audio context on first interaction
    initAudioContext();
    
    this.isDragging = true;
    this.lastAngle = this.getAngleFromEvent(event);
    this.lastTime = Date.now();
    this.velocity = 0;
    this.isMoving = false;
    // Don't start sound yet - wait for actual movement
  }

  startDragTouch(event) {
    if (event.touches.length === 1) {
      this.startDrag(event);
    }
  }

  drag(event) {
    if (!this.isDragging) return;
    event.preventDefault();
    
    // Initialize audio context on first interaction
    initAudioContext();
    
    const currentAngle = this.getAngleFromEvent(event);
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTime;
    
    // Calculate angle difference (handle wrap-around)
    let angleDiff = currentAngle - this.lastAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    // Only update if there's actual movement (more than 1 degree)
    if (Math.abs(angleDiff) > 1) {
      this.isMoving = true;
      
      // Start playing scratch sound only when actually moving
      if (this.scratchSound && (this.scratchSound.paused || this.scratchSound.readyState < 2)) {
        this.scratchSound.currentTime = 0;
        const playPromise = this.scratchSound.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Audio is playing
            })
            .catch(error => {
              console.log('Scratch sound play failed:', error);
              // Try to resume audio context if suspended
              if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                  this.scratchSound.play().catch(e => console.log('Retry failed:', e));
                });
              }
            });
        }
      }
      
      // Trigger neon ring animation instantly
      const ring = this.element.querySelector('.turntable-neon-ring');
      if (ring) {
        ring.classList.add('active');
      }
      
      // Update rotation
      this.rotation += angleDiff;
      this.plate.style.transform = `rotate(${this.rotation}deg)`;
      
      // Calculate velocity for sound pitch/volume adjustment
      if (deltaTime > 0 && this.scratchSound) {
        this.velocity = Math.abs(angleDiff) / deltaTime;
        // Adjust playback rate based on velocity
        if (!this.scratchSound.paused) {
          this.scratchSound.playbackRate = Math.max(0.5, Math.min(2, 1 + this.velocity * 0.01));
        }
      }
    } else {
      // If not moving, stop the sound and ring
      if (this.scratchSound && !this.scratchSound.paused && this.isMoving) {
        this.scratchSound.pause();
        this.scratchSound.currentTime = 0;
        this.scratchSound.playbackRate = 1;
        this.isMoving = false;
        
        // Stop neon ring
        const ring = this.element.querySelector('.turntable-neon-ring');
        if (ring) {
          ring.classList.remove('active');
        }
      }
    }
    
    this.lastAngle = currentAngle;
    this.lastTime = currentTime;
  }

  dragTouch(event) {
    if (event.touches.length === 1) {
      this.drag(event);
    }
  }

  endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.isMoving = false;
    
    // Stop scratch sound immediately when dragging stops
    if (this.scratchSound && !this.scratchSound.paused) {
      this.scratchSound.pause();
      this.scratchSound.currentTime = 0;
      this.scratchSound.volume = 0.7;
      this.scratchSound.playbackRate = 1;
    }
    
    // Stop neon ring
    const ring = this.element.querySelector('.turntable-neon-ring');
    if (ring) {
      ring.classList.remove('active');
    }
  }
}

// Initialize turntables
const turntable1 = new Turntable(document.getElementById('turntable1'), 1);
const turntable2 = new Turntable(document.getElementById('turntable2'), 2);

// Button pad functionality - hold to play
const pads = document.querySelectorAll('.pad');

pads.forEach(pad => {
  let currentSound = null;
  let isPlaying = false;
  let pulseInterval = null;

  // Find an available sound instance
  function getAvailableSound(name) {
    const instances = soundInstances[name];
    if (!instances) return null;
    
    // Find first paused instance
    for (let audio of instances) {
      if (audio.paused) {
        return audio;
      }
    }
    // If all are playing, use the first one
    return instances[0];
  }

  function startSound() {
    if (isPlaying) return;
    
    // Initialize audio context on first interaction
    initAudioContext();
    
    const soundName = pad.dataset.sound;
    currentSound = getAvailableSound(soundName);
    
    if (currentSound) {
      currentSound.currentTime = 0;
      const playPromise = currentSound.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isPlaying = true;
            pad.classList.add('active');
            
            // Trigger neon ring animation continuously
            const ring = pad.querySelector('.neon-ring');
            if (ring) {
              ring.classList.add('pulse');
              // Keep pulsing while sound is playing
              pulseInterval = setInterval(() => {
                if (!isPlaying) {
                  clearInterval(pulseInterval);
                  pulseInterval = null;
                  ring.classList.remove('pulse');
                  return;
                }
                ring.classList.remove('pulse');
                // Force reflow to restart animation
                void ring.offsetWidth;
                ring.classList.add('pulse');
              }, 1500); // Pulse every 1.5 seconds (matching animation duration)
            }
          })
          .catch(error => {
            console.log('Audio play failed:', error, 'Sound:', soundName);
            // Try to resume audio context if suspended
            if (audioContext && audioContext.state === 'suspended') {
              audioContext.resume().then(() => {
                currentSound.play()
                  .then(() => {
                    isPlaying = true;
                    pad.classList.add('active');
                  })
                  .catch(e => console.log('Retry failed:', e));
              });
            }
          });
      }
    }
  }

  function stopSound() {
    if (!isPlaying || !currentSound) return;
    
    currentSound.pause();
    currentSound.currentTime = 0;
    isPlaying = false;
    pad.classList.remove('active');
    
    // Stop neon ring animation
    if (pulseInterval) {
      clearInterval(pulseInterval);
      pulseInterval = null;
    }
    const ring = pad.querySelector('.neon-ring');
    if (ring) {
      ring.classList.remove('pulse');
    }
    
    currentSound = null;
  }

  // Mouse events
  pad.addEventListener('mousedown', (e) => {
    e.preventDefault();
    initAudioContext();
    startSound();
  });

  pad.addEventListener('mouseup', () => {
    stopSound();
  });

  pad.addEventListener('mouseleave', () => {
    stopSound();
  });

  // Touch events - optimized for mobile
  pad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    initAudioContext();
    startSound();
  }, { passive: false });

  pad.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopSound();
  }, { passive: false });

  pad.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    stopSound();
  }, { passive: false });
});
