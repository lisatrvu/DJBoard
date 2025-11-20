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
    // Don't use crossOrigin for local files - it can cause issues on mobile
    // Preload the sound immediately on page load
    audio.load();
    soundInstances[name].push(audio);
    
    // Handle loading errors
    audio.addEventListener('error', (e) => {
      console.error(`Error loading sound: ${name}`, e, `File: sounds/${name}.mp3`);
    });
    
    // Log when sound is ready and ensure it's fully loaded
    audio.addEventListener('canplaythrough', () => {
      console.log(`Sound ready: ${name} (instance ${i + 1})`);
      // Try to preload by setting currentTime (helps with mobile)
      audio.currentTime = 0;
    }, { once: true });
    
    // Also try to load on loadeddata event
    audio.addEventListener('loadeddata', () => {
      console.log(`Sound loaded: ${name} (instance ${i + 1})`);
    }, { once: true });
  }
}

// Create instances for button sounds - preload immediately on page load
createSoundInstances('Beat 1');
createSoundInstances('Beat 2');
createSoundInstances('Bass');
createSoundInstances('Drum');

// Verify sounds are loaded
console.log('Sound instances created:', Object.keys(soundInstances));

// Force preload all sounds immediately (especially important for Bass on mobile)
function preloadAllSounds() {
  Object.keys(soundInstances).forEach(soundName => {
    const instances = soundInstances[soundName];
    instances.forEach((audio, index) => {
      // Force load each instance
      audio.load();
      // Try to preload by accessing readyState
      if (audio.readyState >= 2) {
        console.log(`${soundName} (instance ${index + 1}) already loaded`);
      }
    });
  });
}

// Preload all sounds when page loads
preloadAllSounds();

// Scratch sound instances for each turntable - preload immediately
const scratchSounds = {
  turntable1: null,
  turntable2: null
};

// Create and preload scratch sound instances immediately on page load
function createScratchSound(id) {
  const sound = new Audio('sounds/scratch.mp3');
  sound.preload = 'auto';
  sound.volume = 0.7;
  // Don't use crossOrigin for local files - it can cause issues on mobile
  // Preload the sound immediately
  sound.load();
  // Try to preload by setting currentTime (helps with mobile)
  sound.addEventListener('canplaythrough', () => {
    console.log(`Scratch sound ${id} preloaded and ready`);
  }, { once: true });
  scratchSounds[`turntable${id}`] = sound;
  return sound;
}

// Preload scratch sounds immediately when page loads
const scratchSound1 = createScratchSound(1);
const scratchSound2 = createScratchSound(2);

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
    
    // Use preloaded scratch sound for this turntable
    this.scratchSound = scratchSounds[`turntable${id}`] || createScratchSound(id);
    
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
    this.isMoving = true; // Set to true on touch
    
    // Start playing scratch sound immediately on touch
    if (this.scratchSound) {
      // Ensure audio context is active
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Play sound immediately on touch
      this.scratchSound.currentTime = 0;
      const playPromise = this.scratchSound.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio is playing
          })
          .catch(error => {
            console.log('Scratch sound play failed on touch:', error);
            // Try to resume audio context if suspended
            if (audioContext && audioContext.state === 'suspended') {
              audioContext.resume().then(() => {
                this.scratchSound.play().catch(e => console.log('Retry failed:', e));
              });
            }
          });
      }
      
      // Trigger neon ring animation instantly
      const ring = this.element.querySelector('.turntable-neon-ring');
      if (ring) {
        ring.classList.add('active');
      }
    }
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
    
    // Update rotation immediately (no threshold for visual feedback)
    this.rotation += angleDiff;
    this.plate.style.transform = `rotate(${this.rotation}deg)`;
    
    // Keep sound playing while dragging (it starts on touch)
    if (this.scratchSound && this.isDragging) {
      // Ensure audio context is active
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Keep sound playing if it stopped
      if (this.scratchSound.paused || this.scratchSound.ended) {
        this.scratchSound.currentTime = 0;
        this.scratchSound.play().catch(e => console.log('Scratch sound play failed:', e));
      }
      
      // Keep neon ring active
      const ring = this.element.querySelector('.turntable-neon-ring');
      if (ring) {
        ring.classList.add('active');
      }
      
      // Calculate velocity for sound pitch/volume adjustment based on movement
      if (deltaTime > 0 && Math.abs(angleDiff) > 0.1) {
        this.velocity = Math.abs(angleDiff) / deltaTime;
        // Adjust playback rate based on velocity
        if (!this.scratchSound.paused) {
          this.scratchSound.playbackRate = Math.max(0.5, Math.min(2, 1 + this.velocity * 0.01));
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
    
    if (!currentSound) {
      console.error(`Sound not found: ${soundName}. Available:`, Object.keys(soundInstances));
      // Try to reload the sound
      const instances = soundInstances[soundName];
      if (instances && instances.length > 0) {
        // Try the first instance even if it's not paused
        currentSound = instances[0];
        currentSound.load(); // Reload the sound
      } else {
        return;
      }
    }
    
    // Ensure audio context is active
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    // Ensure sound is loaded
    if (currentSound.readyState < 2) {
      currentSound.load();
    }
    
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
          console.log('Audio play failed:', error, 'Sound:', soundName, 'ReadyState:', currentSound.readyState);
          // Try to resume audio context if suspended
          if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
              // Reload and try again
              currentSound.load();
              currentSound.currentTime = 0;
              currentSound.play()
                .then(() => {
                  isPlaying = true;
                  pad.classList.add('active');
                  
                  // Trigger neon ring animation
                  const ring = pad.querySelector('.neon-ring');
                  if (ring) {
                    ring.classList.add('pulse');
                    pulseInterval = setInterval(() => {
                      if (!isPlaying) {
                        clearInterval(pulseInterval);
                        pulseInterval = null;
                        ring.classList.remove('pulse');
                        return;
                      }
                      ring.classList.remove('pulse');
                      void ring.offsetWidth;
                      ring.classList.add('pulse');
                    }, 1500);
                  }
                })
                .catch(e => console.log('Retry failed:', e, 'Sound:', soundName));
            });
          } else {
            // If no audio context, try reloading the sound
            currentSound.load();
            setTimeout(() => {
              currentSound.play()
                .then(() => {
                  isPlaying = true;
                  pad.classList.add('active');
                })
                .catch(e => console.log('Final retry failed:', e, 'Sound:', soundName));
            }, 100);
          }
        });
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
