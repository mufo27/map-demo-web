import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Cesium from 'cesium';

interface CartItem {
  id: string;
  name: string;
  type: string;
  bounds: any;
  addedAt: Date;
}

@Component({
  selector: 'app-map-phase-v3',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-phase-v3.component.html',
  styleUrl: './map-phase-v3.component.scss',
})
export class MapPhaseV3Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'test-thailand';

  // Layer references for toggling
  private layers = {
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
    demLayer: null as Cesium.ImageryLayer | null,
    contourLayer: null as Cesium.ImageryLayer | null,
  };

  // Layer visibility states (bound to checkboxes)
  layerControls = {
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    roads: false,
    waterways: false,
    demLayer: false,
    contourLayer: false,
  };

  // Phase 3: Shopping Cart
  cart: CartItem[] = [];
  showCart = false;
  selectedFeatures: any[] = [];

  // Phase 3: Selection mode
  selectionMode = false;

  // Phase 3: Watermark settings
  watermarkSettings = {
    enabled: true,
    text: 'DEMO - Not for commercial use',
    opacity: 0.5,
  };

  // Panel collapse states
  panelStates = {
    layerControl: true, // expanded by default
    tools: true, // expanded by default
    cart: false, // collapsed by default
    selection: true, // expanded by default
  };

  // Toggle panel methods
  toggleLayerPanel() {
    this.panelStates.layerControl = !this.panelStates.layerControl;
  }

  toggleToolsPanel() {
    this.panelStates.tools = !this.panelStates.tools;
  }

  ngAfterViewInit(): void {
    (window as any).CESIUM_BASE_URL = '/assets/cesium/';
    this.initCesium();
  }

  initCesium() {
    this.viewer = new Cesium.Viewer('cesiumContainer', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      geocoder: false,
      homeButton: true,
      fullscreenButton: true,
    });

    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();
    this.setupMapClickHandler();

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  setupTier0_Globe() {
    console.log('✓ Tier 0: Globe (Ellipsoid) initialized');
  }

  setupTier1_Terrain() {
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
  }

  setupTier2_Imagery() {
    this.viewer.imageryLayers.removeAll();

    try {
      this.viewer.imageryLayers.addImageryProvider(
        new Cesium.OpenStreetMapImageryProvider({
          url: 'https://a.tile.openstreetmap.org/',
        })
      );
      console.log('✓ Tier 2: OSM Base Map loaded');
    } catch (error) {
      console.error('✗ Error loading OSM:', error);
    }

    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        credit: 'Google Maps Satellite',
      });
      this.layers.googleSatellite =
        this.viewer.imageryLayers.addImageryProvider(provider);
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
      console.log('✓ Tier 2: Google Maps Satellite loaded');
    } catch (error) {
      console.error('✗ Error loading Google Maps:', error);
    }

    // Phase 2/3: เพิ่ม DEM และ Contour layers
    this.addDEMAndContourLayers();
  }

  // ============================================
  // PHASE 2/3: DEM และ Contour Layers
  // ============================================
  addDEMAndContourLayers() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    // DEM Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.demLayer = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:dem_layer`,
    //   'DEM Layer'
    // );

    // Contour Layer (ถ้ามีใน GeoServer)
    // TODO: แก้ layer name ให้ตรงกับ GeoServer
    // this.layers.contourLayer = this.addWMSLayer(
    //   wmsUrl,
    //   `${this.workspace}:contour_layer`,
    //   'Contour Layer'
    // );

    console.log(
      '✓ DEM and Contour layers configured (TODO: add actual layers)'
    );
  }

  setupTier3_VectorFeatures() {
    const wmsUrl = `${this.geoserverUrl}/wms`;

    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:regionth-province-v3`,
      'Province Boundaries'
    );

    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
      'District/Subdistrict Boundaries'
    );

    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads_free_1`,
      'Roads'
    );

    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways_free_1`,
      'Waterways'
    );
  }

  setupMapClickHandler() {
    const handler = new Cesium.ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    handler.setInputAction((movement: any) => {
      const pickedPosition = this.viewer.camera.pickEllipsoid(
        movement.position,
        this.viewer.scene.globe.ellipsoid
      );

      if (pickedPosition) {
        const cartographic = Cesium.Cartographic.fromCartesian(pickedPosition);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);

        if (this.selectionMode) {
          // Phase 3: Selection mode - เลือกพื้นที่
          this.selectAreaAtLocation(longitude, latitude);
        } else {
          // Info mode - แสดงข้อมูล
          console.log(
            `Clicked: Lat ${latitude.toFixed(6)}, Lon ${longitude.toFixed(6)}`
          );
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  // ============================================
  // Phase 3: Selection & Cart Functions
  // ============================================
  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    console.log('Selection mode:', this.selectionMode ? 'ON' : 'OFF');
  }

  selectAreaAtLocation(longitude: number, latitude: number) {
    // TODO: Query GeoServer WFS สำหรับ ระวาง/พื้นที่ ที่ตำแหน่งนี้
    console.log('Selecting area at:', longitude, latitude);

    // Simulate feature selection
    const feature = {
      id: `feature_${Date.now()}`,
      name: `ระวาง (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      type: 'Land Parcel',
      bounds: { lat: latitude, lon: longitude },
    };

    this.selectedFeatures.push(feature);
    console.log('Selected features:', this.selectedFeatures);

    // TODO: แสดง highlight บนแผนที่
  }

  addToCart(feature: any) {
    const cartItem: CartItem = {
      ...feature,
      addedAt: new Date(),
    };

    this.cart.push(cartItem);
    console.log('Added to cart:', cartItem);
    console.log('Cart items:', this.cart);
  }

  addSelectedToCart() {
    this.selectedFeatures.forEach((feature) => {
      this.addToCart(feature);
    });
    this.selectedFeatures = [];
    this.selectionMode = false;
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
  }

  clearCart() {
    this.cart = [];
  }

  toggleCart() {
    this.showCart = !this.showCart;
  }

  // ============================================
  // Phase 3: Watermark Functions
  // ============================================
  async exportWithWatermark() {
    console.log('Exporting with watermark...');
    console.log('Watermark settings:', this.watermarkSettings);

    // TODO: จับภาพจาก Cesium viewer
    // TODO: เพิ่มลายน้ำลงในภาพ
    // TODO: Download file

    alert('Export with watermark feature - Coming soon!');
  }

  toggleWatermark() {
    this.watermarkSettings.enabled = !this.watermarkSettings.enabled;
    console.log('Watermark:', this.watermarkSettings.enabled ? 'ON' : 'OFF');
  }

  // ============================================
  // Helper Methods
  // ============================================
  private addWMSLayer(
    url: string,
    layers: string,
    name: string
  ): Cesium.ImageryLayer | null {
    try {
      const provider = new Cesium.WebMapServiceImageryProvider({
        url,
        layers,
        parameters: {
          transparent: true,
          format: 'image/png',
          styles: '',
        },
      });
      const layer = this.viewer.imageryLayers.addImageryProvider(provider);
      layer.show = false;
      console.log(`✓ Tier 3: ${name} loaded (WMS)`);
      return layer;
    } catch (error) {
      console.error(`✗ Error loading ${name}:`, error);
      return null;
    }
  }

  // Layer toggle methods
  toggleGoogleSatellite() {
    if (this.layers.googleSatellite) {
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
    }
  }

  toggleProvinceBoundaries() {
    if (this.layers.provinceBoundaries) {
      this.layers.provinceBoundaries.show =
        this.layerControls.provinceBoundaries;
    }
  }

  toggleDistrictBoundaries() {
    if (this.layers.districtBoundaries) {
      this.layers.districtBoundaries.show =
        this.layerControls.districtBoundaries;
    }
  }

  toggleRoads() {
    if (this.layers.roads) {
      this.layers.roads.show = this.layerControls.roads;
    }
  }

  toggleWaterways() {
    if (this.layers.waterways) {
      this.layers.waterways.show = this.layerControls.waterways;
    }
  }

  toggleDEMLayer() {
    if (this.layers.demLayer) {
      this.layers.demLayer.show = this.layerControls.demLayer;
    }
  }

  toggleContourLayer() {
    if (this.layers.contourLayer) {
      this.layers.contourLayer.show = this.layerControls.contourLayer;
    }
  }

  ngOnDestroy(): void {
    this.viewer?.destroy();
  }
}
