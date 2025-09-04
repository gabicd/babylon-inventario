import { useState, useRef, useEffect } from 'react'
import QrScanner from 'qr-scanner';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import './App.css'

function App() {
  const reactCanvas = useRef(null)
  const reactEngine = useRef(null)
  const reactScene = useRef(null)
  const inventoryCanvas = useRef(null);
  const inventoryEngine = useRef(null);
  const videoRef = useRef(null); // For the <video> element
  const qrScannerRef = useRef(null); // To hold the qr-scanner instance
  const videoStreamRef = useRef(null); // To hold the MediaStream object
  const originalBoxMaterialRef = useRef(null); // To restore the box material after scanning`

  const [isScannerActive, setIsScannerActive] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null);
  
  function createScene(engine){
   
      const { current: canvas } = reactCanvas

      const scene = new BABYLON.Scene(engine)
      const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        5,
        BABYLON.Vector3.Zero(),
        scene
      )
      
      camera.attachControl(canvas, true)
      const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
 
      const box = BABYLON.MeshBuilder.CreateBox("box", {}, scene);
      const boxMat = new BABYLON.StandardMaterial("boxMat", scene);
      boxMat.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.8);
        box.material = boxMat;

      box.position.y = 0.5


      const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 10, height: 10 }, scene);

      console.log('created scene!')
      return scene
  }

  useEffect(() => {
    if (reactCanvas.current && !reactEngine.current){
      const engine = new BABYLON.Engine(reactCanvas.current, true, {alpha: true, adaptToDeviceRatio: true})
      reactEngine.current = engine
      console.log('created engine!')
    }


  }, [])

  function runScene(){
    const engine = reactEngine.current
    const scene = createScene(engine)
    reactScene.current = scene
    engine.runRenderLoop(() => {
      scene.render()
    })

    window.addEventListener('resize', () => {
      engine.resize();
    });
  }

  const inventoryItems = [
    { id: 1, name: 'Camera', description: 'Utilize para scanear os QR Codes espalhados!', assetUrl: './assets/iphoneX.gltf', function: 'scan' },
    { id: 2, name: 'Card Box', description: 'Guarda sua coleção de cartas', assetUrl: './assets/box.gltf'},
    { id: 3, name: 'Joia', description: 'Item especial da caça ao tesouro', assetUrl: './assets/jewel.glb'},
  ];


  function openInventory(){
    setIsInventoryOpen(true);
  }

  function closeInventory() {
    setIsInventoryOpen(false);
    setSelectedItem(null);
  }

  function openItem(item){
    setSelectedItem(item);
    setIsInventoryOpen(false);
  }

  function closeItem(item){
    setSelectedItem(null);
    setIsInventoryOpen(true);
  }  

  // This function now triggers the scanner
  function useCamera(){
    setSelectedItem(null); // Closes the inventory item view
    setIsScannerActive(true); // Triggers the useEffect to start the scanner
    setScannedData(null); // Clear previous scan results
  }

  // Effect to manage the scanner lifecycle (now using qr-scanner library)
  useEffect(() => {
    const startScanner = async () => {
      const scene = reactScene.current;
      const video = videoRef.current;
      if (!scene || !video) {
        console.error("Scene or video element not ready.");
        setIsScannerActive(false);
        return;
      }
      if (typeof QrScanner === 'undefined') {
        console.error("QrScanner library is not loaded.");
        alert("Error: QR Scanner library not found.");
        setIsScannerActive(false);
        return;
      }

      const box = scene.getMeshByName("box");
      if (!box) {
        console.error("Box mesh not found.");
        setIsScannerActive(false);
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoStreamRef.current = stream;
        video.srcObject = stream;
        video.play();

        await new Promise((resolve) => { video.onloadedmetadata = () => resolve(); });
        
        // Save the original material to restore it later
        originalBoxMaterialRef.current = box.material;

        // Create a new material with the video feed as its texture
        const videoTexture = new BABYLON.VideoTexture("videoTex", video, scene, true, true);
        const videoMat = new BABYLON.StandardMaterial("videoMat", scene);
        videoMat.diffuseTexture = videoTexture;
        videoMat.emissiveColor = new BABYLON.Color3(1, 1, 1); // Make texture bright
        box.material = videoMat;

        // ---- NEW SCANNER LOGIC ----
        qrScannerRef.current = new QrScanner(
          video,
          result => {
            console.log("QR Code Found:", result.data);
            setScannedData(result.data);
            setIsScannerActive(false); // Stop scanning on success
          },
          { 
            highlightScanRegion: true,
            highlightCodeOutline: true,
           },
        );
        await qrScannerRef.current.start();
        // -------------------------

      } catch (err) {
        console.error("Camera access error or scanner failed to start:", err);
        setIsScannerActive(false);
      }
    };

    const stopScanner = () => {
      // Stop the qr-scanner instance
      if (qrScannerRef.current) {
        qrScannerRef.current.destroy();
        qrScannerRef.current = null;
      }
      // Stop the camera stream
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }
      // Restore the box's original material
      const scene = reactScene.current;
      if (scene && originalBoxMaterialRef.current) {
        const box = scene.getMeshByName("box");
        if (box) {
          box.material = originalBoxMaterialRef.current;
        }
      }
    };

    if (isScannerActive) {
      startScanner();
    } else {
      stopScanner();
    }

    // Cleanup function to ensure scanner stops when component unmounts
    return () => {
      stopScanner();
    };
  }, [isScannerActive]);


  useEffect(() => {
    const setupInventoryScene = async () => {
      if (selectedItem && inventoryCanvas.current && selectedItem.assetUrl) {
        inventoryEngine.current = new BABYLON.Engine(inventoryCanvas.current, true, { antialias: true });
        const scene = new BABYLON.Scene(inventoryEngine.current);
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); 

        const camera = new BABYLON.ArcRotateCamera("inventory_camera", Math.PI / 2, Math.PI / 2.5, 10, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(inventoryCanvas.current, true);
        camera.wheelPrecision = 45;
        //camera.lowerRadiusLimit = 0.5 ;
        //camera.upperRadiusLimit = 20;
        
        const light = new BABYLON.HemisphericLight("inventory_light", new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 1.2;

        try {
          const result = await BABYLON.SceneLoader.ImportMeshAsync(null, selectedItem.assetUrl, "", scene, null)
          const itemMesh = result;
          const rootMesh = result.meshes[0]

          

          //rootMesh.scaling = new BABYLON.Vector3(2, 2, 2);
          const boundingBoxInfo = rootMesh.getHierarchyBoundingVectors()
          const size = boundingBoxInfo.max.subtract(boundingBoxInfo.min);
          const maxDimension = Math.max(size.x, size.y, size.z);
          // --- NEW LOGIC for Consistent Animation Start Size ---
          const desiredFinalSize = 2.5;
          const desiredInitialVisualSize = 0.25; // All objects will start at this visual size

          // Calculate scale factors based on a desired visual size, not relatively
          const finalScaleFactor = maxDimension > 0 ? desiredFinalSize / maxDimension : 1;
          const initialScaleFactor = maxDimension > 0 ? desiredInitialVisualSize / maxDimension : 1;
          
          const finalScale = new BABYLON.Vector3(finalScaleFactor, finalScaleFactor, finalScaleFactor);
          const initialScale = new BABYLON.Vector3(initialScaleFactor, initialScaleFactor, initialScaleFactor);

          initialScale.z *= -1;
          finalScale.z *= -1;

          rootMesh.position = BABYLON.Vector3.Zero();
          rootMesh.scaling = initialScale; // Set initial size before animation

          // Calculate duration based on the ratio of change for consistency
          const scaleRatio = finalScaleFactor / initialScaleFactor;
          const baseDuration = 25;
          const durationMultiplier = 8;
          const animationDuration = Math.round(baseDuration + Math.log(scaleRatio) * durationMultiplier);
          
          const openAnim = new BABYLON.Animation("openAnim", "scaling", 30, BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
          const keys = [];
          keys.push({ frame: 0, value: initialScale });
          keys.push({ frame: animationDuration, value: finalScale });
          openAnim.setKeys(keys);
          
          const easingFunction = new BABYLON.CubicEase();
          easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
          openAnim.setEasingFunction(easingFunction);
          
          scene.beginDirectAnimation(rootMesh, [openAnim], 0, animationDuration, false);

        } catch (error) {
          console.error("Failed to load asset: ", error)
        }


        inventoryEngine.current.runRenderLoop(() => {
            scene.render();
        });
            window.addEventListener('resize', () => {
      inventoryEngine.current.resize();
    });
    }      
    }

    setupInventoryScene()
    

    return () => {
      inventoryEngine.current?.dispose();
    }
  }, [selectedItem]);  
  

  return (
    <>
      <div className="scene-container">
        <button onClick={runScene}>Click to start scene!</button>
        <canvas ref={reactCanvas} id='react-canvas'></canvas>
        <button onClick={openInventory} id='inventory-button'>inventory</button>
      
        {isInventoryOpen && (
          <div className="inventory-overlay">
            <div className="inventory-panel">
              <button onClick={closeInventory} className="close-button">X</button>
              <h2>Inventory</h2>
              <div className="inventory-grid">
                {inventoryItems.map(item => (
                  <div key={item.id} className="inventory-item" onClick={() => openItem(item)}>
                    {item.name.substring(0, 1)}
                  </div>
                ))}
              </div>


            </div>
          </div>
        )}  

                      {/* Display item details when an item is clicked */}
              {selectedItem && (
                <div className="inventory-overlay">
                  <button onClick={closeItem} className="close-button">X</button>
                  <canvas ref={inventoryCanvas} id="inventory-canvas"></canvas>
                {selectedItem.function &&(
                  <button onClick={useCamera}>use camera</button>
                )}
                </div>
              )}  

        {isScannerActive && (
          <div className="scanner-overlay">
            <video ref={videoRef} id="scanner-video" playsInline autoPlay muted></video>
            {/* The qr-scanner library adds its own canvas overlay, so we don't need a custom one */}
            <button onClick={() => setIsScannerActive(false)} className="close-scanner-button">X</button>
          </div>
        )}     

                {scannedData && (
          <div className="scanner-overlay result-panel">
            <h3>QR Code Scanned!</h3>
            <p>{scannedData}</p>
            <button onClick={() => setScannedData(null)}>Close</button>
          </div>
        )}
      </div>
    </>
  )
}

export default App
