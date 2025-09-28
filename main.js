// 导入Three.js核心库和必要的扩展模块
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; // 轨道控制器，用于相机控制
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; // GLTF模型加载器
import { Octree } from "three/addons/math/Octree.js"; // 八叉树，用于碰撞检测优化
import { Capsule } from "three/addons/math/Capsule.js"; // 胶囊体，用于角色碰撞器

// ==================== 音频系统配置 ====================
// 使用Howler.js库管理所有游戏音效
const sounds = {
  // 背景音乐 - 循环播放，音量较低
  backgroundMusic: new Howl({
    src: ["./sfx/music.ogg"],
    loop: true,        // 循环播放
    volume: 0.3,       // 音量设置为30%
    preload: true,     // 预加载音频文件
  }),

  // 项目交互音效 - 点击项目时播放
  projectsSFX: new Howl({
    src: ["./sfx/projects.ogg"],
    volume: 0.5,       // 音量设置为50%
    preload: true,
  }),

  // 宝可梦交互音效 - 点击宝可梦角色时播放
  pokemonSFX: new Howl({
    src: ["./sfx/pokemon.ogg"],
    volume: 0.5,
    preload: true,
  }),

  // 跳跃音效 - 角色移动时播放
  jumpSFX: new Howl({
    src: ["./sfx/jumpsfx.ogg"],
    volume: 1.0,       // 最大音量
    preload: true,
  }),
};

// ==================== 全局状态变量 ====================
let touchHappened = false; // 标记是否发生了触摸事件，用于区分点击和触摸
let isMuted = false;       // 静音状态标记，控制所有音效的播放

// ==================== 音频控制函数 ====================
/**
 * 播放指定音效
 * @param {string} soundId - 音效ID，对应sounds对象中的键名
 */
function playSound(soundId) {
  // 只有在非静音状态且音效存在时才播放
  if (!isMuted && sounds[soundId]) {
    sounds[soundId].play();
  }
}

/**
 * 停止指定音效
 * @param {string} soundId - 音效ID
 */
function stopSound(soundId) {
  if (sounds[soundId]) {
    sounds[soundId].stop();
  }
}

// ==================== Three.js 场景初始化 ====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaec972); // 设置场景背景色为浅绿色

// 获取画布元素并设置尺寸
const canvas = document.getElementById("experience-canvas");
const sizes = {
  width: window.innerWidth,   // 窗口宽度
  height: window.innerHeight, // 窗口高度
};

// ==================== 物理系统配置 ====================
const GRAVITY = 30;           // 重力强度
const CAPSULE_RADIUS = 0.35;  // 角色碰撞器半径
const CAPSULE_HEIGHT = 1;     // 角色碰撞器高度
const JUMP_HEIGHT = 11;       // 跳跃高度
const MOVE_SPEED = 7;         // 移动速度

// 角色对象，存储角色实例和相关状态
let character = {
  instance: null,                    // 角色3D模型实例
  isMoving: false,                   // 是否正在移动
  spawnPosition: new THREE.Vector3(), // 角色出生位置
};

let targetRotation = Math.PI / 2;    // 目标旋转角度

// 创建碰撞检测系统
const colliderOctree = new Octree(); // 八叉树，用于高效碰撞检测
const playerCollider = new Capsule(  // 角色碰撞器（胶囊体）
  new THREE.Vector3(0, CAPSULE_RADIUS, 0),  // 胶囊体起点
  new THREE.Vector3(0, CAPSULE_HEIGHT, 0),  // 胶囊体终点
  CAPSULE_RADIUS                            // 胶囊体半径
);

let playerVelocity = new THREE.Vector3(); // 角色速度向量
let playerOnFloor = false;                 // 角色是否在地面上

// ==================== 渲染器配置 ====================
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true, // 开启抗锯齿
});

renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比，提高性能
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 设置阴影类型为软阴影
renderer.shadowMap.enabled = true;                // 启用阴影
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 色调映射
renderer.toneMappingExposure = 1.7;               // 曝光度

// ==================== DOM元素获取 ====================
let isModalOpen = false; // 模态框是否打开
const modal = document.querySelector(".modal");                    // 模态框
const modalbgOverlay = document.querySelector(".modal-bg-overlay"); // 模态框背景遮罩
const modalTitle = document.querySelector(".modal-title");         // 模态框标题
const modalProjectDescription = document.querySelector(".modal-project-description"); // 模态框描述
const modalExitButton = document.querySelector(".modal-exit-button"); // 模态框关闭按钮
const modalVisitProjectButton = document.querySelector(".modal-project-visit-button"); // 访问项目按钮
const themeToggleButton = document.querySelector(".theme-mode-toggle-button"); // 主题切换按钮
const firstIcon = document.querySelector(".first-icon");           // 主题图标1
const secondIcon = document.querySelector(".second-icon");         // 主题图标2
const audioToggleButton = document.querySelector(".audio-toggle-button"); // 音频切换按钮
const firstIconTwo = document.querySelector(".first-icon-two");    // 音频图标1
const secondIconTwo = document.querySelector(".second-icon-two");  // 音频图标2

// ==================== 模态框内容配置 ====================
const modalContent = {
  Project_1: {
    title: "🍜Recipe Finder👩🏻‍��",
    content: "Let's get cooking! This project uses TheMealDB API for some recipes and populates my React card components. This shows my skills in working with consistent design systems using components. There is also pagination to switch pages.",
    link: "https://example.com/",
  },
  Project_2: {
    title: "📋ToDo List✏️",
    content: "Keeping up with everything is really exhausting so I wanted to create my own ToDo list app. But I wanted my ToDo list to look like an actual ToDo list so I used Tailwind CSS for consistency and also did state management with React hooks like useState.",
    link: "https://example.com/",
  },
  Project_3: {
    title: "��Weather App��",
    content: "Rise and shine as they say (but sometimes it's not all that shiny outside). Using a location-based API the user can automatically detect their location and my application will show them the weather near them. I also put some of my design skills to use using Figma.",
    link: "https://example.com/",
  },
  Chest: {
    title: "💁‍♀️ About Me",
    content: "Hi you found my chest👋, I'm Bella Xu and I am an aspiring creative developer and designer. I just started web development this year! In the signs, you will see some of my most recent projects that I'm proud of. I hope to add a lot more in the future. In my free time, I like to draw, watch TV shows (especially Pokémon), do clay sculpting and needle felting. Reach out if you wanna chat. Bella is OUT!!! 🏃‍♀️",
  },
  Picnic: {
    title: "🍷 Uggh yesss 🧺",
    content: " Picnics are my thanggg don't @ me. Lying down with some good grape juice inna wine glass and a nice book at a park is my total vibe. If this isn't max aura points 💯 idk what is.",
  },
};

// ==================== 模态框控制函数 ====================
/**
 * 显示模态框
 * @param {string} id - 模态框内容ID
 */
function showModal(id) {
  const content = modalContent[id];
  if (content) {
    modalTitle.textContent = content.title;
    modalProjectDescription.textContent = content.content;

    // 如果有链接，显示访问按钮；否则隐藏
    if (content.link) {
      modalVisitProjectButton.href = content.link;
      modalVisitProjectButton.classList.remove("hidden");
    } else {
      modalVisitProjectButton.classList.add("hidden");
    }
    
    modal.classList.remove("hidden");
    modalbgOverlay.classList.remove("hidden");
    isModalOpen = true;
  }
}

/**
 * 隐藏模态框
 */
function hideModal() {
  isModalOpen = false;
  modal.classList.add("hidden");
  modalbgOverlay.classList.add("hidden");
  
  // 播放关闭音效
  if (!isMuted) {
    playSound("projectsSFX");
  }
}

// ==================== 射线投射系统 ====================
// 用于检测鼠标/触摸点击的3D对象
const raycaster = new THREE.Raycaster(); // 射线投射器
const pointer = new THREE.Vector2();     // 鼠标/触摸位置

let intersectObject = ""; // 当前相交的对象名称
const intersectObjects = []; // 可交互对象数组
const intersectObjectsNames = [ // 可交互对象名称列表
  "Project_1", "Project_2", "Project_3", // 项目对象
  "Picnic",                               // 野餐对象
  "Squirtle", "Chicken", "Pikachu",      // 宝可梦角色
  "Bulbasaur", "Charmander", "Snorlax",  // 更多宝可梦角色
  "Chest",                                // 宝箱对象
];

// ==================== 加载屏幕管理 ====================
const loadingScreen = document.getElementById("loadingScreen");
const loadingText = document.querySelector(".loading-text");
const enterButton = document.querySelector(".enter-button");
const instructions = document.querySelector(".instructions");

// 创建加载管理器
const manager = new THREE.LoadingManager();

// 加载完成时的回调
manager.onLoad = function () {
  const t1 = gsap.timeline(); // 创建GSAP时间线动画

  // 隐藏加载文字
  t1.to(loadingText, {
    opacity: 0,
    duration: 0,
  });

  // 显示进入按钮
  t1.to(enterButton, {
    opacity: 1,
    duration: 0,
  });
};

// 进入按钮点击事件
enterButton.addEventListener("click", () => {
  // 隐藏加载屏幕
  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0,
  });
  
  // 隐藏说明文字
  gsap.to(instructions, {
    opacity: 0,
    duration: 0,
    onComplete: () => {
      loadingScreen.remove(); // 移除加载屏幕元素
    },
  });

  // 播放音效
  if (!isMuted) {
    playSound("projectsSFX");
    playSound("backgroundMusic");
  }
});

// ==================== 3D模型加载 ====================
const loader = new GLTFLoader(manager);

loader.load(
  "./JokeBear-Park.glb", // 3D模型文件路径
  function (glb) {
    // 遍历模型中的所有子对象
    glb.scene.traverse((child) => {
      // 将可交互对象添加到数组中
      if (intersectObjectsNames.includes(child.name)) {
        intersectObjects.push(child);
      }
      
      // 为所有网格对象启用阴影
      if (child.isMesh) {
        child.castShadow = true;    // 投射阴影
        child.receiveShadow = true; // 接收阴影
      }

      // 设置角色相关属性
      if (child.name === "Character") {
        character.spawnPosition.copy(child.position); // 保存出生位置
        character.instance = child; // 保存角色实例
        
        // 设置角色碰撞器位置
        playerCollider.start
          .copy(child.position)
          .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
        playerCollider.end
          .copy(child.position)
          .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));
      }
      
      // 设置地面碰撞器
      if (child.name === "Ground_Collider") {
        colliderOctree.fromGraphNode(child); // 从地面节点构建八叉树
        child.visible = false; // 隐藏碰撞器（不可见）
      }
    });
    
    scene.add(glb.scene); // 将整个模型添加到场景中
  },
  undefined, // 加载进度回调（未使用）
  function (error) { // 错误处理
    console.error(error);
  }
);

// ==================== 光照系统 ====================
// 主光源（太阳光）
const sun = new THREE.DirectionalLight(0xffffff);
sun.castShadow = true; // 启用阴影投射
sun.position.set(280, 200, -80); // 设置光源位置
sun.target.position.set(100, 0, -10); // 设置光源目标位置
sun.shadow.mapSize.width = 4096;  // 阴影贴图宽度
sun.shadow.mapSize.height = 4096; // 阴影贴图高度
sun.shadow.camera.left = -150;    // 阴影相机左边界
sun.shadow.camera.right = 300;    // 阴影相机右边界
sun.shadow.camera.top = 150;      // 阴影相机上边界
sun.shadow.camera.bottom = -100;  // 阴影相机下边界
sun.shadow.normalBias = 0.2;      // 阴影法线偏移
scene.add(sun.target);
scene.add(sun);

// 环境光（提供整体照明）
const light = new THREE.AmbientLight(0x404040, 2.7);
scene.add(light);

// ==================== 相机系统 ====================
const aspect = sizes.width / sizes.height; // 宽高比
const camera = new THREE.OrthographicCamera( // 正交相机
  -aspect * 50,  // 左边界
  aspect * 50,   // 右边界
  50,            // 上边界
  -50,           // 下边界
  1,             // 近平面
  1000           // 远平面
);

// 设置相机初始位置
camera.position.x = -13;
camera.position.y = 39;
camera.position.z = -67;

const cameraOffset = new THREE.Vector3(-13, 39, -67); // 相机偏移量

camera.zoom = 2.2; // 设置缩放级别
camera.updateProjectionMatrix(); // 更新投影矩阵

// 创建轨道控制器
const controls = new OrbitControls(camera, canvas);
controls.update();

// ==================== 窗口大小调整处理 ====================
function onResize() {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  const aspect = sizes.width / sizes.height;
  
  // 更新相机边界
  camera.left = -aspect * 50;
  camera.right = aspect * 50;
  camera.top = 50;
  camera.bottom = -50;
  camera.updateProjectionMatrix();

  // 更新渲染器尺寸
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// ==================== 角色跳跃动画系统 ====================
let isCharacterReady = true; // 角色是否准备好进行下一次跳跃

/**
 * 让指定角色执行跳跃动画
 * @param {string} meshID - 角色网格ID
 */
function jumpCharacter(meshID) {
  if (!isCharacterReady) return; // 如果角色还没准备好，直接返回

  const mesh = scene.getObjectByName(meshID); // 获取角色网格对象
  const jumpHeight = 2;    // 跳跃高度
  const jumpDuration = 0.5; // 跳跃持续时间
  const isSnorlax = meshID === "Snorlax"; // 是否为卡比兽（特殊处理）

  // 保存当前缩放值
  const currentScale = {
    x: mesh.scale.x,
    y: mesh.scale.y,
    z: mesh.scale.z,
  };

  const t1 = gsap.timeline(); // 创建动画时间线

  // 第一阶段：压缩动画（准备跳跃）
  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1.2,
    y: isSnorlax ? currentScale.y * 0.8 : 0.8,
    z: isSnorlax ? currentScale.z * 1.2 : 1.2,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  // 第二阶段：拉伸动画（跳跃中）
  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 0.8 : 0.8,
    y: isSnorlax ? currentScale.y * 1.3 : 1.3,
    z: isSnorlax ? currentScale.z * 0.8 : 0.8,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  // 同时进行位置上升动画
  t1.to(
    mesh.position,
    {
      y: mesh.position.y + jumpHeight,
      duration: jumpDuration * 0.5,
      ease: "power2.out",
    },
    "<" // 与上一个动画同时开始
  );

  // 第三阶段：恢复动画（落地）
  t1.to(mesh.scale, {
    x: isSnorlax ? currentScale.x * 1.2 : 1,
    y: isSnorlax ? currentScale.y * 1.2 : 1,
    z: isSnorlax ? currentScale.z * 1.2 : 1,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  // 位置下降动画
  t1.to(
    mesh.position,
    {
      y: mesh.position.y,
      duration: jumpDuration * 0.5,
      ease: "bounce.out", // 弹跳效果
      onComplete: () => {
        isCharacterReady = true; // 动画完成，角色准备就绪
      },
    },
    ">" // 在上一个动画完成后开始
  );

  // 非卡比兽角色的额外弹性动画
  if (!isSnorlax) {
    t1.to(mesh.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: jumpDuration * 0.2,
      ease: "elastic.out(1, 0.3)", // 弹性效果
    });
  }
}

// ==================== 交互处理系统 ====================
/**
 * 处理鼠标点击事件
 */
function onClick() {
  if (touchHappened) return; // 如果是触摸事件，忽略点击
  handleInteraction();
}

/**
 * 处理所有交互逻辑
 */
function handleInteraction() {
  // 如果模态框已打开，不处理交互
  if (!modal.classList.contains("hidden")) {
    return;
  }

  // 设置射线投射
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(intersectObjects);

  // 获取相交的对象
  if (intersects.length > 0) {
    intersectObject = intersects[0].object.parent.name;
  } else {
    intersectObject = "";
  }

  // 处理不同类型的交互
  if (intersectObject !== "") {
    // 宝可梦角色交互（跳跃动画）
    if (
      [
        "Bulbasaur", "Chicken", "Pikachu",
        "Charmander", "Squirtle", "Snorlax",
      ].includes(intersectObject)
    ) {
      if (isCharacterReady) {
        if (!isMuted) {
          playSound("pokemonSFX"); // 播放宝可梦音效
        }
        jumpCharacter(intersectObject); // 执行跳跃动画
        isCharacterReady = false;
      }
    } else {
      // 其他对象交互（显示模态框）
      if (intersectObject) {
        showModal(intersectObject);
        if (!isMuted) {
          playSound("projectsSFX"); // 播放项目音效
        }
      }
    }
  }
}

/**
 * 处理鼠标移动事件
 * @param {MouseEvent} event - 鼠标事件
 */
function onMouseMove(event) {
  // 将屏幕坐标转换为标准化设备坐标
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  touchHappened = false; // 重置触摸标记
}

/**
 * 处理触摸结束事件
 * @param {TouchEvent} event - 触摸事件
 */
function onTouchEnd(event) {
  // 将触摸坐标转换为标准化设备坐标
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  touchHappened = true; // 标记为触摸事件
  handleInteraction(); // 处理交互
}

// ==================== 角色移动和物理系统 ====================
/**
 * 重置角色到出生位置
 */
function respawnCharacter() {
  character.instance.position.copy(character.spawnPosition);

  // 重置碰撞器位置
  playerCollider.start
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_RADIUS, 0));
  playerCollider.end
    .copy(character.spawnPosition)
    .add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0));

  playerVelocity.set(0, 0, 0); // 重置速度
  character.isMoving = false;  // 重置移动状态
}

/**
 * 处理角色碰撞检测
 */
function playerCollisions() {
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;

  if (result) {
    // 检查是否在地面上（法线Y分量大于0）
    playerOnFloor = result.normal.y > 0;
    
    // 移动碰撞器避免穿透
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    // 如果在地面上，停止水平移动
    if (playerOnFloor) {
      character.isMoving = false;
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

/**
 * 更新角色状态
 */
function updatePlayer() {
  if (!character.instance) return;

  // 如果角色掉得太低，重置位置
  if (character.instance.position.y < -20) {
    respawnCharacter();
    return;
  }

  // 重力效果
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035;
  }

  // 移动碰撞器
  playerCollider.translate(playerVelocity.clone().multiplyScalar(0.035));

  // 处理碰撞
  playerCollisions();

  // 更新角色位置
  character.instance.position.copy(playerCollider.start);
  character.instance.position.y -= CAPSULE_RADIUS;

  // 平滑旋转到目标角度
  let rotationDiff =
    ((((targetRotation - character.instance.rotation.y) % (2 * Math.PI)) +
      3 * Math.PI) %
      (2 * Math.PI)) -
    Math.PI;
  let finalRotation = character.instance.rotation.y + rotationDiff;

  character.instance.rotation.y = THREE.MathUtils.lerp(
    character.instance.rotation.y,
    finalRotation,
    0.4 // 旋转插值系数
  );
}

// ==================== 键盘输入处理 ====================
/**
 * 处理键盘按下事件
 * @param {KeyboardEvent} event - 键盘事件
 */
function onKeyDown(event) {
  // R键重置角色位置
  if (event.code.toLowerCase() === "keyr") {
    respawnCharacter();
    return;
  }

  // 处理移动按键
  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = true;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = true;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = true;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = true;
      break;
  }
}

/**
 * 处理键盘释放事件
 * @param {KeyboardEvent} event - 键盘事件
 */
function onKeyUp(event) {
  switch (event.code.toLowerCase()) {
    case "keyw":
    case "arrowup":
      pressedButtons.up = false;
      break;
    case "keys":
    case "arrowdown":
      pressedButtons.down = false;
      break;
    case "keya":
    case "arrowleft":
      pressedButtons.left = false;
      break;
    case "keyd":
    case "arrowright":
      pressedButtons.right = false;
      break;
  }
}

// ==================== 主题切换功能 ====================
/**
 * 切换明暗主题
 */
function toggleTheme() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  
  const isDarkTheme = document.body.classList.contains("dark-theme");
  document.body.classList.toggle("dark-theme");
  document.body.classList.toggle("light-theme");

  // 切换主题图标
  if (firstIcon.style.display === "none") {
    firstIcon.style.display = "block";
    secondIcon.style.display = "none";
  } else {
    firstIcon.style.display = "none";
    secondIcon.style.display = "block";
  }

  // 使用GSAP动画平滑过渡光照效果
  gsap.to(light.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.31,
    b: isDarkTheme ? 1.0 : 0.78,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(light, {
    intensity: isDarkTheme ? 0.8 : 0.9,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun, {
    intensity: isDarkTheme ? 1 : 0.8,
    duration: 1,
    ease: "power2.inOut",
  });

  gsap.to(sun.color, {
    r: isDarkTheme ? 1.0 : 0.25,
    g: isDarkTheme ? 1.0 : 0.41,
    b: isDarkTheme ? 1.0 : 0.88,
    duration: 1,
    ease: "power2.inOut",
  });
}

// ==================== 音频切换功能 ====================
/**
 * 切换音频开关
 */
function toggleAudio() {
  if (!isMuted) {
    playSound("projectsSFX");
  }
  
  // 切换音频图标
  if (firstIconTwo.style.display === "none") {
    firstIconTwo.style.display = "block";
    secondIconTwo.style.display = "none";
    isMuted = false;
    sounds.backgroundMusic.play(); // 播放背景音乐
  } else {
    firstIconTwo.style.display = "none";
    secondIconTwo.style.display = "block";
    isMuted = true;
    sounds.backgroundMusic.pause(); // 暂停背景音乐
  }
}

// ==================== 移动端控制 ====================
// 移动端控制按钮
const mobileControls = {
  up: document.querySelector(".mobile-control.up-arrow"),
  left: document.querySelector(".mobile-control.left-arrow"),
  right: document.querySelector(".mobile-control.right-arrow"),
  down: document.querySelector(".mobile-control.down-arrow"),
};

// 按键状态跟踪
const pressedButtons = {
  up: false,
  left: false,
  right: false,
  down: false,
};

/**
 * 处理角色跳跃动画
 */
function handleJumpAnimation() {
  if (!character.instance || !character.isMoving) return;

  const jumpDuration = 0.5;
  const jumpHeight = 2;

  const t1 = gsap.timeline();

  // 跳跃动画序列
  t1.to(character.instance.scale, {
    x: 1.08,
    y: 0.9,
    z: 1.08,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    x: 0.92,
    y: 1.1,
    z: 0.92,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  });

  t1.to(character.instance.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  });

  t1.to(character.instance.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: jumpDuration * 0.2,
  });
}

/**
 * 处理连续移动
 */
function handleContinuousMovement() {
  if (!character.instance) return;

  // 检查是否有按键被按下且角色未在移动
  if (
    Object.values(pressedButtons).some((pressed) => pressed) &&
    !character.isMoving
  ) {
    if (!isMuted) {
      playSound("jumpSFX"); // 播放跳跃音效
    }
    
    // 根据按键设置移动方向和目标旋转
    if (pressedButtons.up) {
      playerVelocity.z += MOVE_SPEED;
      targetRotation = 0;
    }
    if (pressedButtons.down) {
      playerVelocity.z -= MOVE_SPEED;
      targetRotation = Math.PI;
    }
    if (pressedButtons.left) {
      playerVelocity.x += MOVE_SPEED;
      targetRotation = Math.PI / 2;
    }
    if (pressedButtons.right) {
      playerVelocity.x -= MOVE_SPEED;
      targetRotation = -Math.PI / 2;
    }

    playerVelocity.y = JUMP_HEIGHT; // 设置跳跃速度
    character.isMoving = true;      // 标记为移动状态
    handleJumpAnimation();          // 播放跳跃动画
  }
}

// 为移动端控制按钮添加事件监听器
Object.entries(mobileControls).forEach(([direction, element]) => {
  // 触摸开始事件
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  // 触摸结束事件
  element.addEventListener("touchend", (e) => {
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  // 鼠标按下事件
  element.addEventListener("mousedown", (e) => {
    e.preventDefault();
    pressedButtons[direction] = true;
  });

  // 鼠标释放事件
  element.addEventListener("mouseup", (e) => {
    e.preventDefault();
    pressedButtons[direction] = false;
  });

  // 鼠标离开事件
  element.addEventListener("mouseleave", (e) => {
    pressedButtons[direction] = false;
  });

  // 触摸取消事件
  element.addEventListener("touchcancel", (e) => {
    pressedButtons[direction] = false;
  });
});

// 窗口失去焦点时重置所有按键状态
window.addEventListener("blur", () => {
  Object.keys(pressedButtons).forEach((key) => {
    pressedButtons[key] = false;
  });
});

// ==================== 事件监听器注册 ====================
modalExitButton.addEventListener("click", hideModal);
modalbgOverlay.addEventListener("click", hideModal);
themeToggleButton.addEventListener("click", toggleTheme);
audioToggleButton.addEventListener("click", toggleAudio);
window.addEventListener("resize", onResize);
window.addEventListener("click", onClick, { passive: false });
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("touchend", onTouchEnd, { passive: false });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);

// ==================== 主渲染循环 ====================
/**
 * 主动画循环函数
 * 每一帧都会调用此函数来更新场景和渲染画面
 */
function animate() {
  // 更新角色状态
  updatePlayer();
  handleContinuousMovement();

  // 相机跟随角色
  if (character.instance) {
    const targetCameraPosition = new THREE.Vector3(
      character.instance.position.x + cameraOffset.x - 20,
      cameraOffset.y,
      character.instance.position.z + cameraOffset.z + 30
    );
    camera.position.copy(targetCameraPosition);
    camera.lookAt(
      character.instance.position.x + 10,
      camera.position.y - 39,
      character.instance.position.z + 10
    );
  }

  // 更新射线投射
  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObjects(intersectObjects);

  // 根据是否与对象相交来改变鼠标指针样式
  if (intersects.length > 0) {
    document.body.style.cursor = "pointer";
  } else {
    document.body.style.cursor = "default";
    intersectObject = "";
  }

  // 更新相交对象
  for (let i = 0; i < intersects.length; i++) {
    intersectObject = intersects[0].object.parent.name;
  }

  // 渲染场景
  renderer.render(scene, camera);
}

// 启动渲染循环
renderer.setAnimationLoop(animate);