// Sound management - create separate instances to prevent overlapping
const soundInstances = {
  bass: [],
  beats: []
};

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
const scratchSound = new Audio('sounds/scratch.mp3');
scratchSound.preload = 'auto';
scratchSound.volume = 0.7;

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
    
    this.init();
  }

  init() {
    this.element.addEventListener('mousedown', this.startDrag.bind(this));
    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('mouseup', this.endDrag.bind(this));
    
    // Touch support
    this.element.addEventListener('touchstart', this.startDragTouch.bind(this));
    document.addEventListener('touchmove', this.dragTouch.bind(this));
    document.addEventListener('touchend', this.endDrag.bind(this));
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
      if (scratchSound.paused) {
        scratchSound.currentTime = 0;
        scratchSound.play().catch(e => console.log('Audio play failed:', e));
      }
      
      // Update rotation
      this.rotation += angleDiff;
      this.plate.style.transform = `rotate(${this.rotation}deg)`;
      
      // Calculate velocity for sound pitch/volume adjustment
      if (deltaTime > 0) {
        this.velocity = Math.abs(angleDiff) / deltaTime;
        // Adjust playback rate based on velocity
        if (!scratchSound.paused) {
          scratchSound.playbackRate = Math.max(0.5, Math.min(2, 1 + this.velocity * 0.01));
        }
      }
    } else {
      // If not moving, stop the sound
      if (!scratchSound.paused && this.isMoving) {
        scratchSound.pause();
        scratchSound.currentTime = 0;
        scratchSound.playbackRate = 1;
        this.isMoving = false;
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
    if (!scratchSound.paused) {
      scratchSound.pause();
      scratchSound.currentTime = 0;
      scratchSound.volume = 0.7;
      scratchSound.playbackRate = 1;
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
