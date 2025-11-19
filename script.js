// Screen management
let currentScreen = 'orientation';
const orientationScreen = document.getElementById('orientation-screen');
const instructionScreen = document.getElementById('instruction-screen');
const mainContent = document.getElementById('main-content');
const startButton = document.getElementById('start-button');

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
    instructionScreen.classList.add('hidden');
    mainContent.classList.add('hidden');
    currentScreen = 'orientation';
  } else if (currentScreen === 'orientation') {
    // Move to instruction screen
    orientationScreen.classList.add('hidden');
    instructionScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
    currentScreen = 'instruction';
  }
}

// Listen for orientation changes
window.addEventListener('resize', updateScreen);
window.addEventListener('orientationchange', () => {
  setTimeout(updateScreen, 100); // Small delay for orientation to settle
});

// Start button handler
startButton.addEventListener('click', () => {
  instructionScreen.classList.add('hidden');
  mainContent.classList.remove('hidden');
  currentScreen = 'main';
  // Initialize turntables immediately (they should work even without audio)
  initTurntables();
  // Initialize audio after user interaction
  initAudio();
});

// Initialize on load
updateScreen();

// Sound management - create separate instances to prevent overlapping
const soundInstances = {
  bass: [],
  beats: []
};

let audioInitialized = false;

// Initialize audio (called after user interaction)
function initAudio() {
  if (audioInitialized) return;
  audioInitialized = true;

  // Create multiple instances for each sound to allow quick retriggering
  function createSoundInstances(name, count = 3) {
    for (let i = 0; i < count; i++) {
      const audio = new Audio(`sounds/${name}.mp3`);
      audio.preload = 'auto';
      audio.volume = 0.7;
      audio.loop = true; // Loop while held down
      soundInstances[name].push(audio);
    }
  }

  // Create instances for button sounds
  createSoundInstances('bass');
  createSoundInstances('beats');

  // Scratch sound (single instance for turntables)
  window.scratchSound = new Audio('sounds/scratch.mp3');
  window.scratchSound.preload = 'auto';
  window.scratchSound.volume = 0.7;
  
  // Initialize pads after audio is ready
  initPads();
}

// Scratch sound placeholder (will be initialized after user interaction)
let scratchSound = null;

// Turntable functionality
class Turntable {
  constructor(element, id) {
    this.element = element;
    this.plate = element.querySelector('.turntable-plate');
    this.id = id;
    this.isDragging = false;
    this.lastAngle = 0;
    this.currentAngle = 0;
    this.rotation = 0;
    this.lastTime = 0;
    this.velocity = 0;
    
    this.init();
  }

  init() {
    // Mouse events
    this.element.addEventListener('mousedown', this.startDrag.bind(this), { passive: false });
    document.addEventListener('mousemove', this.drag.bind(this), { passive: false });
    document.addEventListener('mouseup', this.endDrag.bind(this), { passive: false });
    
    // Touch support
    this.element.addEventListener('touchstart', this.startDragTouch.bind(this), { passive: false });
    document.addEventListener('touchmove', this.dragTouch.bind(this), { passive: false });
    document.addEventListener('touchend', this.endDrag.bind(this), { passive: false });
    document.addEventListener('touchcancel', this.endDrag.bind(this), { passive: false });
  }

  getAngleFromEvent(event) {
    const rect = this.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;
    
    return Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  }

  startDrag(event) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
    this.lastAngle = this.getAngleFromEvent(event);
    this.lastTime = Date.now();
    this.velocity = 0;
    
    // Start playing scratch sound if available
    const sound = window.scratchSound || scratchSound;
    if (sound) {
      try {
        if (sound.paused) {
          sound.currentTime = 0;
          sound.play().catch(e => console.log('Audio play failed:', e));
        }
      } catch (e) {
        console.log('Audio not ready yet:', e);
      }
    }
  }

  startDragTouch(event) {
    if (event.touches.length === 1) {
      event.preventDefault();
      event.stopPropagation();
      this.startDrag(event);
    }
  }

  drag(event) {
    if (!this.isDragging) return;
    event.preventDefault();
    event.stopPropagation();
    
    const currentAngle = this.getAngleFromEvent(event);
    const currentTime = Date.now();
    const deltaTime = currentTime - this.lastTime;
    
    // Calculate angle difference (handle wrap-around)
    let angleDiff = currentAngle - this.lastAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;
    
    // Update rotation - this should always work
    this.rotation += angleDiff;
    if (this.plate) {
      this.plate.style.transform = `rotate(${this.rotation}deg)`;
    }
    
    // Calculate velocity for sound pitch/volume adjustment
    if (deltaTime > 0) {
      this.velocity = Math.abs(angleDiff) / deltaTime;
      // Adjust playback rate based on velocity
      const sound = window.scratchSound || scratchSound;
      if (sound && !sound.paused) {
        try {
          sound.playbackRate = Math.max(0.5, Math.min(2, 1 + this.velocity * 0.01));
        } catch (e) {
          // Audio might not be ready
        }
      }
    }
    
    this.lastAngle = currentAngle;
    this.lastTime = currentTime;
  }

  dragTouch(event) {
    if (event.touches.length === 1 && this.isDragging) {
      event.preventDefault();
      event.stopPropagation();
      this.drag(event);
    }
  }

  endDrag(event) {
    if (!this.isDragging) return;
    this.isDragging = false;
    
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // Fade out or stop scratch sound
    const sound = window.scratchSound || scratchSound;
    if (sound && !sound.paused) {
      const fadeOut = setInterval(() => {
        if (sound.volume > 0.1) {
          sound.volume -= 0.1;
        } else {
          sound.pause();
          sound.volume = 0.7;
          sound.playbackRate = 1;
          clearInterval(fadeOut);
        }
      }, 50);
    }
  }
}

// Initialize turntables (called after audio is ready)
function initTurntables() {
  const turntable1El = document.getElementById('turntable1');
  const turntable2El = document.getElementById('turntable2');
  
  if (turntable1El && !window.turntable1) {
    window.turntable1 = new Turntable(turntable1El, 1);
  }
  if (turntable2El && !window.turntable2) {
    window.turntable2 = new Turntable(turntable2El, 2);
  }
}

// Button pad functionality - hold to play
function initPads() {
  const pads = document.querySelectorAll('.pad');
  
  if (pads.length === 0 || window.padsInitialized) return;
  window.padsInitialized = true;

  pads.forEach(pad => {
  let currentSound = null;
  let isPlaying = false;

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
    
    const soundName = pad.dataset.sound;
    currentSound = getAvailableSound(soundName);
    
    if (currentSound) {
      currentSound.currentTime = 0;
      currentSound.play().catch(e => console.log('Audio play failed:', e));
      isPlaying = true;
      pad.classList.add('active');
    }
  }

  function stopSound() {
    if (!isPlaying || !currentSound) return;
    
    currentSound.pause();
    currentSound.currentTime = 0;
    isPlaying = false;
    pad.classList.remove('active');
    currentSound = null;
  }

  // Mouse events
  pad.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startSound();
  });

  pad.addEventListener('mouseup', () => {
    stopSound();
  });

  pad.addEventListener('mouseleave', () => {
    stopSound();
  });

  // Touch events
  pad.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startSound();
  });

  pad.addEventListener('touchend', () => {
    stopSound();
  });

  pad.addEventListener('touchcancel', () => {
    stopSound();
  });
  });
}
