import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule, ButtonModule, CardModule, GridModule, TableModule } from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import {
    cilMap,
    cilLocationPin,
    cilPin,
    cilBuilding,
    cilCursor,
    cilChevronRight,
    cilChevronBottom,
    cilFilter,
    cilFile,
    cilImage,
    cilSave,
    cilTrash,
} from '@coreui/icons';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AutoCompleteModule } from 'primeng/autocomplete';
import * as Cesium from 'cesium';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-map-phase-v2',
    standalone: true,
    imports: [CommonModule, FormsModule, ModalModule, ButtonModule, CardModule, GridModule, TableModule, AutoCompleteModule, IconModule],
    templateUrl: './map-phase-v2.component.html',
    styleUrl: './map-phase-v2.component.scss',
})
export class MapPhaseV2Component implements AfterViewInit, OnDestroy {
    viewer!: Cesium.Viewer;
    private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
    private workspace = 'thailand-demo';

    constructor(private iconSetService: IconSetService) {
        this.iconSetService.icons = {
            cilMap,
            cilLocationPin,
            cilPin,
            cilBuilding,
            cilCursor,
            cilChevronRight,
            cilChevronBottom,
            cilFilter,
            cilFile,
            cilImage,
            cilSave,
            cilTrash,
        };
    }

    // IMAGE Layers (WMS/Tiles) - Tier 2
    private imageryLayers = {
        openStreetMap: null as Cesium.ImageryLayer | null,
        googleSatellite: null as Cesium.ImageryLayer | null,
        openStreetMapSelf: null as Cesium.ImageryLayer | null,

        // These are WMS layers (images)
        buildings: null as Cesium.ImageryLayer | null,
        transportKamphaengPhet4k: null as Cesium.ImageryLayer | null,
        transportThailand: null as Cesium.ImageryLayer | null,
        transportKamphaengPhet25k: null as Cesium.ImageryLayer | null,

        // Optional WMS versions of boundaries (if used in Tier 2)
        provinceBoundaries: null as Cesium.ImageryLayer | null,
        districtBoundaries: null as Cesium.ImageryLayer | null,
        subDistrictBoundaries: null as Cesium.ImageryLayer | null,
        roads: null as Cesium.ImageryLayer | null,
        railways: null as Cesium.ImageryLayer | null,
        waterways: null as Cesium.ImageryLayer | null,
        pois: null as Cesium.ImageryLayer | null,
    };

    // VECTOR Layers (WFS/GeoJSON) - Tier 3
    private vectorLayers = {
        province: null as Cesium.GeoJsonDataSource | null,
        district: null as Cesium.GeoJsonDataSource | null,
        subDistrict: null as Cesium.GeoJsonDataSource | null,
        pois: null as Cesium.GeoJsonDataSource | null,
        roads: null as Cesium.GeoJsonDataSource | null,
        railways: null as Cesium.GeoJsonDataSource | null,
        waterways: null as Cesium.GeoJsonDataSource | null,
    };

    // Track which VECTOR layers have been loaded
    private vectorLayersLoaded = {
        province: false,
        district: false,
        subDistrict: false,
        pois: false,
        roads: false,
        railways: false,
        waterways: false,
    };

    // Controls for IMAGERY Layers (Tier 2) - Binds to Checkboxes
    imageryControls = {
        openStreetMap: false,
        googleSatellite: false,
        openStreetMapSelf: false,

        buildings: false, // Tier 4 (WMS)

        transportKamphaengPhet4k: false,
        transportThailand: false,
        transportKamphaengPhet25k: false,

        // WMS Boundaries (if we want to show them as images)
        provinceBoundaries: false,
        districtBoundaries: false,
        subDistrictBoundaries: false,
        roads: false,
        railways: false,
        waterways: false,
        pois: false,
    };

    // Controls for VECTOR Layers (Tier 3) - Binds to Checkboxes
    vectorControls = {
        province: false,
        district: false,
        subDistrict: false,
        pois: false,
        roads: false,
        railways: false,
        waterways: false,
    };

    // Tier controls for hierarchical layer management
    tierControls = {
        tier0: true, // Globe/Ellipsoid (default on)
        tier1: false, // Terrain/DEM
        tier2: false, // Imagery layers
        tier3: false, // Vector/Features layers
        tier4: false, // 3D Tiles/Buildings
    };

    // Tier collapse states (true = collapsed)
    tierCollapsed = {
        tier0: true,
        tier1: true,
        tier2: true,
        tier3: false, // Show tier 3 layers by default
        tier4: true,
    };

    panelCollapsed = false;

    searchQuery: any;
    suggestions: any[] = [];
    searchTimeout: any;

    // Search panel collapse
    searchPanelCollapsed = false;

    // Advanced search
    advancedSearchExpanded = false;
    transportKamphaengPhet4kSearchQuery = '';
    transportThailandSearchQuery = '';
    transportKamphaengPhet25kSearchQuery = '';
    transportKamphaengPhet4kResults: any[] = [];
    transportThailandResults: any[] = [];
    transportKamphaengPhet25kResults: any[] = [];

    selectedFeature: any = null;
    modalVisible = false;
    private handler: Cesium.ScreenSpaceEventHandler | null = null;
    private pinEntity: Cesium.Entity | null = null;
    private cameraChangeListener: any = null;
    private lastCameraHeight: number = 0;
    currentCameraHeight: number = 2000000; // Default start height

    // Shopping cart for selected parcels
    selectedParcels: any[] = [];
    cartVisible = false;
    cartCollapsed = true;
    checkoutModalVisible = false;
    private selectedParcelEntities: Cesium.Entity[] = [];

    // Zoom level thresholds (in meters) - Based on camera height from globe
    private zoomLevels = {
        country: 2000000, // ~2000 km - Province level (minLevel: 0, maxLevel: 6)
        region: 500000, // ~500 km - District level (minLevel: 6, maxLevel: 9)
        city: 100000, // ~100 km - Sub-district level (minLevel: 9, maxLevel: 12)
        transportKamphaengPhet4k: Number.POSITIVE_INFINITY, // Kamphaeng Phet 4k: Always show when enabled (no zoom limit)
        transportThailand: Number.POSITIVE_INFINITY, // Thailand: Always show when enabled (no zoom limit)
        transportKamphaengPhet25k: Number.POSITIVE_INFINITY, // Kamphaeng Phet 25k: Always show when enabled (no zoom limit)
        roads: 20000, // ~20 km - Roads/Railways/Waterways level (minLevel: 12, maxLevel: 15)
        neighborhood: 5000, // ~5 km - POI level (minLevel: 15, maxLevel: 18)
        street: 1000, // ~1 km - Building level (minLevel: 18, maxLevel: 21)
    };

    fieldLabels: { [key: string]: string } = {
        PROV_NAMT: 'ชื่อจังหวัด (ไทย)',
        PROV_NAME: 'ชื่อจังหวัด (อังกฤษ)',
        Area_km2_: 'พื้นที่ (ตร.กม.)',
        AMP_NAME_T: 'ชื่ออำเภอ (ไทย)',
        AMP_NAME_E: 'ชื่ออำเภอ (อังกฤษ)',
        P_NAME_T: 'ชื่อจังหวัด (ไทย)',
        P_NAME_E: 'ชื่อจังหวัด (อังกฤษ)',
        A_NAME_T: 'ชื่ออำเภอ (ไทย)',
        A_NAME_E: 'ชื่ออำเภอ (อังกฤษ)',
        T_NAME_T: 'ชื่อตำบล (ไทย)',
        T_NAME_E: 'ชื่อตำบล (อังกฤษ)',
        Shape_Leng: 'ความยาวขอบเขต',
        Shape_Area: 'พื้นที่',
        NAME: 'ชื่อ',
        name: 'ชื่อ',
        PARCEL_NO: 'เลขระวาง',
        PARCEL_ID: 'รหัสเลขระวาง',
        PARCEL_AREA: 'พื้นที่ระวาง',
    };

    togglePanel() {
        this.panelCollapsed = !this.panelCollapsed;
    }

    toggleSearchPanel() {
        this.searchPanelCollapsed = !this.searchPanelCollapsed;
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
            infoBox: false,
            selectionIndicator: false,
        });

        const creditContainer = this.viewer.cesiumWidget.creditContainer as HTMLElement;
        if (creditContainer) {
            creditContainer.style.display = 'none';
        }

        this.setupTier0_Globe();
        this.setupTier1_Terrain();
        this.setupTier2_Imagery();
        this.setupTier3_VectorFeatures();
        this.setupInteraction();
        this.setupCameraListener();

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

    setupCameraListener() {
        this.cameraChangeListener = this.viewer.camera.changed.addEventListener(() => {
            const cameraHeight = this.viewer.camera.positionCartographic.height;
            this.currentCameraHeight = cameraHeight;

            // Only update if height changed significantly (>10% change or >10km)
            const heightDiff = Math.abs(cameraHeight - this.lastCameraHeight);
            if (heightDiff > this.lastCameraHeight * 0.1 || heightDiff > 10000) {
                this.lastCameraHeight = cameraHeight;
                this.updateLayerVisibilityByZoom(cameraHeight);
            }
        });
        console.log('✓ Camera zoom listener initialized');
    }

    updateLayerVisibilityByZoom(cameraHeight: number) {
        // Zoom levels based on camera height
        const showProvince = cameraHeight > this.zoomLevels.country;
        const showDistrict = cameraHeight <= this.zoomLevels.country && cameraHeight > this.zoomLevels.region;
        const showSubDistrict = cameraHeight <= this.zoomLevels.region && cameraHeight > this.zoomLevels.city;

        // --- 1. IMAGERY LAYERS (Tier 2/4) ---
        // Controlled by imageryControls

        // WMS Boundaries (if loaded)
        if (this.imageryLayers.provinceBoundaries) {
            this.imageryLayers.provinceBoundaries.show = showProvince && this.imageryControls.provinceBoundaries;
        }
        if (this.imageryLayers.districtBoundaries) {
            this.imageryLayers.districtBoundaries.show = showDistrict && this.imageryControls.districtBoundaries;
        }
        if (this.imageryLayers.subDistrictBoundaries) {
            this.imageryLayers.subDistrictBoundaries.show = showSubDistrict && this.imageryControls.subDistrictBoundaries;
        }

        // Transport Layers (WMS)
        if (this.imageryLayers.transportKamphaengPhet4k) {
            this.imageryLayers.transportKamphaengPhet4k.show =
                cameraHeight < this.zoomLevels.transportKamphaengPhet4k && this.imageryControls.transportKamphaengPhet4k;
        }
        if (this.imageryLayers.transportThailand) {
            this.imageryLayers.transportThailand.show = cameraHeight < this.zoomLevels.transportThailand && this.imageryControls.transportThailand;
        }
        if (this.imageryLayers.transportKamphaengPhet25k) {
            this.imageryLayers.transportKamphaengPhet25k.show =
                cameraHeight < this.zoomLevels.transportKamphaengPhet25k && this.imageryControls.transportKamphaengPhet25k;
        }

        // Other WMS Layers (Roads/Rails/Water/POIs as Images - if loaded)
        if (this.imageryLayers.roads) {
            this.imageryLayers.roads.show = cameraHeight < this.zoomLevels.roads && this.imageryControls.roads;
        }
        if (this.imageryLayers.railways) {
            this.imageryLayers.railways.show = cameraHeight < this.zoomLevels.roads && this.imageryControls.railways;
        }
        if (this.imageryLayers.waterways) {
            this.imageryLayers.waterways.show = cameraHeight < this.zoomLevels.roads && this.imageryControls.waterways;
        }
        if (this.imageryLayers.pois) {
            this.imageryLayers.pois.show = cameraHeight < this.zoomLevels.neighborhood && this.imageryControls.pois;
        }

        // Buildings (Tier 4)
        if (this.imageryLayers.buildings) {
            this.imageryLayers.buildings.show = cameraHeight < this.zoomLevels.street && this.imageryControls.buildings;
        }

        // --- 2. VECTOR LAYERS (Tier 3) ---
        // Controlled by vectorControls + Lazy Loading

        // Note: Logic simplified: if Tier 3 is ON, and specific layer is ON, and Zoom is correct -> Load & Show.
        if (this.tierControls.tier3) {
            // Province (Vector)
            if (this.vectorControls.province && cameraHeight > this.zoomLevels.country) {
                if (!this.vectorLayersLoaded.province) {
                    this.loadWFSVector(`${this.workspace}:th_province`, 'province', '#E1BEE7', 1.5, 1000, 'rgba(225, 190, 231, 0.08)');
                }
            }
            if (this.vectorLayers.province) {
                this.vectorLayers.province.show = cameraHeight > this.zoomLevels.country && this.vectorControls.province;
            }

            // District (Vector)
            if (this.vectorControls.district && cameraHeight <= this.zoomLevels.country && cameraHeight > this.zoomLevels.region) {
                if (!this.vectorLayersLoaded.district) {
                    this.loadWFSVector(`${this.workspace}:thailand-amphoe`, 'district', '#FFE0B2', 1.2, 2000, 'rgba(255, 224, 178, 0.06)');
                }
            }
            if (this.vectorLayers.district) {
                this.vectorLayers.district.show =
                    cameraHeight <= this.zoomLevels.country && cameraHeight > this.zoomLevels.region && this.vectorControls.district;
            }

            // Sub-district (Vector)
            if (this.vectorControls.subDistrict && cameraHeight <= this.zoomLevels.region && cameraHeight > this.zoomLevels.city) {
                if (!this.vectorLayersLoaded.subDistrict) {
                    this.loadWFSVector(`${this.workspace}:thailand-tambon`, 'subDistrict', '#E0E0E0', 0.8, 3000, 'rgba(224, 224, 224, 0.04)');
                }
            }
            if (this.vectorLayers.subDistrict) {
                this.vectorLayers.subDistrict.show =
                    cameraHeight <= this.zoomLevels.region && cameraHeight > this.zoomLevels.city && this.vectorControls.subDistrict;
            }

            // Waterways (Vector)
            if (this.vectorControls.waterways && cameraHeight < this.zoomLevels.roads) {
                if (!this.vectorLayersLoaded.waterways) {
                    this.loadWFSVector(`${this.workspace}:gis_osm_waterways`, 'waterways', '#A8DADC', 1.5, 5000, 'rgba(168, 218, 220, 0.15)');
                }
            }
            if (this.vectorLayers.waterways) {
                this.vectorLayers.waterways.show = cameraHeight < this.zoomLevels.roads && this.vectorControls.waterways;
            }

            // Railways (Vector)
            if (this.vectorControls.railways && cameraHeight < this.zoomLevels.roads) {
                if (!this.vectorLayersLoaded.railways) {
                    this.loadWFSVector(`${this.workspace}:gis_osm_railways`, 'railways', '#757575', 2.5, 3000, 'rgba(117, 117, 117, 0.6)');
                }
            }
            if (this.vectorLayers.railways) {
                this.vectorLayers.railways.show = cameraHeight < this.zoomLevels.roads && this.vectorControls.railways;
            }

            // Roads (Vector)
            if (this.vectorControls.roads && cameraHeight < this.zoomLevels.roads) {
                if (!this.vectorLayersLoaded.roads) {
                    this.loadWFSVector(`${this.workspace}:gis_osm_roads`, 'roads', '#BDBDBD', 1.8, 5000, 'rgba(250, 250, 250, 0.7)');
                }
            }
            if (this.vectorLayers.roads) {
                this.vectorLayers.roads.show = cameraHeight < this.zoomLevels.roads && this.vectorControls.roads;
            }

            // POIs (Vector)
            if (this.vectorControls.pois && cameraHeight < this.zoomLevels.neighborhood) {
                if (!this.vectorLayersLoaded.pois) {
                    this.loadWFSVector(`${this.workspace}:gis_osm_pois`, 'pois', '#EA4335', 1.5, 2000, 'rgba(234, 67, 53, 0.12)');
                }
            }
            if (this.vectorLayers.pois) {
                this.vectorLayers.pois.show = cameraHeight < this.zoomLevels.neighborhood && this.vectorControls.pois;
            }
        } else {
            // Hide all Tier 3 vector layers when tier is disabled
            // We only need to hide what is loaded
            if (this.vectorLayers.roads) this.vectorLayers.roads.show = false;
            if (this.vectorLayers.railways) this.vectorLayers.railways.show = false;
            if (this.vectorLayers.waterways) this.vectorLayers.waterways.show = false;
            if (this.vectorLayers.province) this.vectorLayers.province.show = false;
            if (this.vectorLayers.district) this.vectorLayers.district.show = false;
            if (this.vectorLayers.subDistrict) this.vectorLayers.subDistrict.show = false;
            if (this.vectorLayers.pois) this.vectorLayers.pois.show = false;
        }

        console.log(`📏 Zoom updated: ${(cameraHeight / 1000).toFixed(1)} km`);
    }

    setupTier2_Imagery() {
        console.log('✓ Tier 2: Using Cesium default base map (Bing Maps)');

        try {
            const provider = new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
            });
            this.imageryLayers.openStreetMap = this.viewer.imageryLayers.addImageryProvider(provider);
            this.imageryLayers.openStreetMap.show = this.imageryControls.openStreetMap;
            this.viewer.imageryLayers.raiseToTop(this.imageryLayers.openStreetMap);
            console.log('✓ Tier 2: OpenStreetMap loaded (optional)');
        } catch (error) {
            console.error('✗ Error loading OSM:', error);
        }

        try {
            const provider = new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                credit: 'Google Maps Satellite',
            });
            this.imageryLayers.googleSatellite = this.viewer.imageryLayers.addImageryProvider(provider);
            this.imageryLayers.googleSatellite.show = this.imageryControls.googleSatellite;
            this.viewer.imageryLayers.raiseToTop(this.imageryLayers.googleSatellite);
            console.log('✓ Tier 2: Google Maps Satellite loaded');
        } catch (error) {
            console.error('✗ Error loading Google Maps:', error);
        }

        const wmsUrl = `${this.geoserverUrl}/wms`;

        // Restore WMS versions of boundaries and infrastructure for Tier 2 (Imagery)
        this.imageryLayers.provinceBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:th_province`, 'Province Boundaries', 1);
        this.imageryLayers.districtBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand-amphoe`, 'District Boundaries', 2);
        this.imageryLayers.subDistrictBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand-tambon`, 'SubDistrict Boundaries', 3);

        this.imageryLayers.waterways = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_waterways`, 'Waterways', 4);
        this.imageryLayers.railways = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_railways`, 'Railways', 5);
        this.imageryLayers.roads = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_roads`, 'Roads', 6);
        this.imageryLayers.pois = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_pois`, 'POIs', 7);
    }

    setupTier3_VectorFeatures() {
        const wmsUrl = `${this.geoserverUrl}/wms`;

        // Only load WMS layers that are NOT vector features (these will be loaded via WFS in Tier 3)
        // BUT we store them in imageryLayers now as they are Images/WMS.
        this.imageryLayers.openStreetMapSelf = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand`, 'Open Street Map (Self)', 0);

        // Buildings (Tier 4) - loaded as WMS
        this.imageryLayers.buildings = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_buildings_a`, 'Buildings', 8);

        // Transport layers (Tier 2) - loaded as WMS for parcel selection
        this.imageryLayers.transportThailand = this.addWMSLayer(wmsUrl, `${this.workspace}:transport-thailand`, 'เลขระวาง ประเทศไทย (สปภ.)', 11);

        this.imageryLayers.transportKamphaengPhet4k = this.addWMSLayer(
            wmsUrl,
            `${this.workspace}:transport-kamphaeng_phet_4k`,
            'เลขระวาง จังหวัดกำแพงเพชร (4k)',
            9
        );

        this.imageryLayers.transportKamphaengPhet25k = this.addWMSLayer(
            wmsUrl,
            `${this.workspace}:transport-kamphaeng_phet_25k`,
            'เลขระวาง จังหวัดกำแพงเพชร (25k)',
            10
        );

        // Note: Province, District, SubDistrict, Roads, Railways, Waterways, POIs
        // are now loaded via WFS in Tier 3 for interactive vector features using vectorLayers.
        console.log('✓ Tier 3: Vector features will be loaded via WFS when enabled');
    }

    private addWMSLayer(url: string, layers: string, name: string, zIndex: number = 0): Cesium.ImageryLayer | null {
        try {
            const provider = new Cesium.WebMapServiceImageryProvider({
                url,
                layers,
                parameters: {
                    transparent: true,
                    format: 'image/png',
                    styles: '',
                    INFO_FORMAT: 'application/json',
                },
            });
            const layer = this.viewer.imageryLayers.addImageryProvider(provider);
            layer.show = false;

            for (let i = 0; i < zIndex; i++) {
                this.viewer.imageryLayers.raise(layer);
            }

            console.log(`✓ Tier 3: ${name} loaded (WMS) at z-index ${zIndex}`);
            return layer;
        } catch (error) {
            console.error(`✗ Error loading ${name}:`, error);
            return null;
        }
    }

    // Load WFS vector data as GeoJSON (lazy loading)
    private async loadWFSVector(
        typeName: string,
        key: keyof typeof this.vectorLayers, // Updated key type
        strokeColor: string = '#1a73e8',
        strokeWidth: number = 2,
        maxFeatures: number = 2000,
        fillColor: string = 'rgba(255, 255, 255, 0.01)'
    ) {
        // Skip if already loaded or currently loading
        if (this.vectorLayersLoaded[key]) {
            console.log(`⏭️ Vector layer already loaded: ${key}`);
            return;
        }

        // Set flag immediately
        this.vectorLayersLoaded[key] = true;

        const url = `${this.geoserverUrl}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=${maxFeatures}`;
        const startTime = performance.now();

        try {
            const dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString(strokeColor),
                fill: Cesium.Color.fromCssColorString(fillColor),
                strokeWidth: strokeWidth,
            });

            this.viewer.dataSources.add(dataSource);
            this.vectorLayers[key] = dataSource; // Update storage
            dataSource.show = false;

            const endTime = performance.now();
            const loadTime = ((endTime - startTime) / 1000).toFixed(2);
            const featureCount = dataSource.entities.values.length;

            console.log(`✅ [${key}] Vector layer loaded successfully!`);
            console.log(`   📊 Features: ${featureCount}`);
            console.log(`   ⏱️ Load time: ${loadTime}s`);

            // Update visibility immediately
            this.updateLayerVisibilityByZoom(this.currentCameraHeight);
        } catch (e) {
            const endTime = performance.now();
            const loadTime = ((endTime - startTime) / 1000).toFixed(2);

            // Reset flag on error
            this.vectorLayersLoaded[key] = false;

            console.error(`❌ [${key}] Failed to load WFS: ${typeName}`);
            console.error(`   ⏱️ Failed after: ${loadTime}s`);
            console.error(`   🔴 Error:`, e);
        }
    }

    toggleOpenStreetMap() {
        if (this.imageryLayers.openStreetMap) {
            this.imageryLayers.openStreetMap.show = this.imageryControls.openStreetMap;
        }
    }

    toggleGoogleSatellite() {
        if (this.imageryLayers.googleSatellite) {
            this.imageryLayers.googleSatellite.show = this.imageryControls.googleSatellite;
        }
    }

    // Toggle methods now delegate to zoom update logic
    toggleProvinceBoundaries() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleDistrictBoundaries() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleSubDistrictBoundaries() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleRoads() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleRailways() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleWaterways() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    togglePOIs() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleTransportKamphaengPhet4k() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleTransportThailand() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleTransportKamphaengPhet25k() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleOpenStreetMapSelf() {
        if (this.imageryLayers.openStreetMapSelf) {
            this.imageryLayers.openStreetMapSelf.show = this.imageryControls.openStreetMapSelf;
        }
    }

    toggleBuildings() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Tier 0: Toggle Globe visibility
    toggleTier0() {
        if (this.viewer && this.viewer.scene) {
            this.viewer.scene.globe.show = this.tierControls.tier0;
            console.log('Tier 0 Globe:', this.tierControls.tier0 ? 'ON' : 'OFF');
        }
    }

    // Toggle Tier 0 collapse/expand
    toggleTier0Collapse() {
        this.tierCollapsed.tier0 = !this.tierCollapsed.tier0;
    }

    // Tier 1: Toggle Terrain
    toggleTier1() {
        if (this.viewer) {
            if (this.tierControls.tier1) {
                // Enable terrain (you can add real terrain provider here if available)
                // this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                console.log('Tier 1 Terrain: ON (Ellipsoid)');
            } else {
                // Disable terrain (use flat ellipsoid)
                // this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                console.log('Tier 1 Terrain: OFF');
            }
        }
    }

    // Toggle Tier 1 collapse/expand
    toggleTier1Collapse() {
        this.tierCollapsed.tier1 = !this.tierCollapsed.tier1;
    }

    // Tier 2: Toggle all Imagery layers (WMS/Tile layers only)
    toggleTier2() {
        // Toggle imagery layer controls
        const isEnabled = this.tierControls.tier2;
        this.imageryControls.openStreetMap = isEnabled;
        this.imageryControls.googleSatellite = isEnabled;
        this.imageryControls.openStreetMapSelf = isEnabled;
        this.imageryControls.transportKamphaengPhet4k = isEnabled;
        this.imageryControls.transportThailand = isEnabled;
        this.imageryControls.transportKamphaengPhet25k = isEnabled;

        // Also toggle the WMS versions of boundaries/infrastructure
        this.imageryControls.provinceBoundaries = isEnabled;
        this.imageryControls.districtBoundaries = isEnabled;
        this.imageryControls.subDistrictBoundaries = isEnabled;
        this.imageryControls.waterways = isEnabled;
        this.imageryControls.railways = isEnabled;
        this.imageryControls.roads = isEnabled;
        this.imageryControls.pois = isEnabled;

        this.toggleOpenStreetMap();
        this.toggleGoogleSatellite();
        this.toggleOpenStreetMapSelf();
        this.toggleTransportKamphaengPhet4k();
        this.toggleTransportThailand();
        this.toggleTransportKamphaengPhet25k();

        // Trigger updates for the boundary/infra layers
        // (Note: they share toggle methods with vector layers but updateLayerVisibilityByZoom checks both controls)
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Tier 2 collapse/expand
    toggleTier2Collapse() {
        this.tierCollapsed.tier2 = !this.tierCollapsed.tier2;
    }

    // Tier 3: Vector/Features (WFS layers with lazy loading)
    toggleTier3() {
        console.log('Tier 3 Vector/Features:', this.tierControls.tier3 ? 'ON' : 'OFF');

        // Toggle all vector layer controls
        this.vectorControls.province = this.tierControls.tier3;
        this.vectorControls.district = this.tierControls.tier3;
        this.vectorControls.subDistrict = this.tierControls.tier3;
        this.vectorControls.waterways = this.tierControls.tier3;
        this.vectorControls.railways = this.tierControls.tier3;
        this.vectorControls.roads = this.tierControls.tier3;
        this.vectorControls.pois = this.tierControls.tier3;

        // Update visibility for all vector layers
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Tier 3 collapse/expand
    toggleTier3Collapse() {
        this.tierCollapsed.tier3 = !this.tierCollapsed.tier3;
    }

    // Tier 4: Toggle 3D Tiles/Buildings
    toggleTier4() {
        this.imageryControls.buildings = this.tierControls.tier4;
        this.toggleBuildings();
        console.log('Tier 4 3D Tiles/Buildings:', this.tierControls.tier4 ? 'ON' : 'OFF');
    }

    // Toggle Tier 4 collapse/expand
    toggleTier4Collapse() {
        this.tierCollapsed.tier4 = !this.tierCollapsed.tier4;
    }

    async search(event: any) {
        const query = event.query;
        if (!query || query.trim().length === 0) {
            this.suggestions = [];
            return;
        }

        try {
            this.suggestions = await this.searchGeoServer(query);
        } catch (error) {
            console.error('Search error:', error);
            this.suggestions = [];
        }
    }

    async searchGeoServer(query: string): Promise<any[]> {
        const results: any[] = [];

        try {
            const provinceResults = await this.searchLayer(`${this.workspace}:th_province`, query, 'province', 'PROV_NAMT', 'PROV_NAME');
            results.push(...provinceResults);

            const districtResults = await this.searchLayer(`${this.workspace}:thailand-amphoe`, query, 'district', 'AMP_NAME_T', 'AMP_NAME_E');
            results.push(...districtResults);

            const subDistrictResults = await this.searchLayer(`${this.workspace}:thailand-tambon`, query, 'subdistrict', 'T_NAME_T', 'T_NAME_E');
            results.push(...subDistrictResults);

            const poiResults = await this.searchLayer(`${this.workspace}:gis_osm_pois`, query, 'poi', 'name', 'name');
            results.push(...poiResults);

            // Note: Parcel searches are now handled in the Advanced Search panel
        } catch (error) {
            console.error('GeoServer search error:', error);
        }

        return results.slice(0, 10);
    }

    async searchLayer(layerName: string, query: string, type: string, thField: string, enField: string): Promise<any[]> {
        try {
            const wfsUrl = `${this.geoserverUrl}/wfs`;
            const filter = `${thField} LIKE '%${query}%' OR ${enField} LIKE '%${query}%'`;

            const params = new URLSearchParams({
                service: 'WFS',
                version: '1.0.0',
                request: 'GetFeature',
                typeName: layerName,
                outputFormat: 'application/json',
                CQL_FILTER: filter,
                maxFeatures: '5',
                srsName: 'EPSG:4326',
            });

            const fullUrl = `${wfsUrl}?${params.toString()}`;
            console.log('🔍 Search Request:', {
                layerName,
                query,
                filter,
                url: fullUrl,
            });

            const response = await fetch(fullUrl);

            console.log('📡 Response Status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ WFS Error Response:', errorText);
                throw new Error(`WFS request failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 WFS Response Data:', data);

            if (!data.features || data.features.length === 0) {
                console.warn('⚠️ No features found for query:', query);
                return [];
            }

            console.log(`✅ Found ${data.features.length} features`);

            return data.features.map((feature: any) => {
                const props = feature.properties;
                const geometry = feature.geometry;

                console.log('📄 Feature properties:', props);
                let longitude = 0;
                let latitude = 0;
                let height = 50000;
                if (geometry.type === 'Point') {
                    [longitude, latitude] = geometry.coordinates;
                } else if (geometry.type === 'Polygon') {
                    const coords = geometry.coordinates[0];
                    longitude = coords.reduce((sum: number, c: any) => sum + c[0], 0) / coords.length;
                    latitude = coords.reduce((sum: number, c: any) => sum + c[1], 0) / coords.length;
                    height = type === 'province' ? 200000 : 100000;
                } else if (geometry.type === 'MultiPolygon') {
                    const coords = geometry.coordinates[0][0];
                    longitude = coords.reduce((sum: number, c: any) => sum + c[0], 0) / coords.length;
                    latitude = coords.reduce((sum: number, c: any) => sum + c[1], 0) / coords.length;
                    height = type === 'province' ? 200000 : 100000;
                }
                const nameTh = props[thField] !== undefined && props[thField] !== null ? String(props[thField]) : '';
                const nameEn = props[enField] !== undefined && props[enField] !== null ? String(props[enField]) : '';
                const displayName = nameTh || nameEn || 'N/A';

                console.log(`📌 Parsed: ${displayName} at (${longitude}, ${latitude})`);

                return {
                    name: displayName,
                    nameTh,
                    nameEn,
                    type,
                    typeLabel: this.getTypeLabel(type),
                    longitude,
                    latitude,
                    height,
                    icon: this.getTypeIcon(type),
                };
            });
        } catch (error) {
            console.error(`❌ Error searching ${layerName}:`, error);
            return [];
        }
    }

    getTypeLabel(type: string): string {
        const labels: { [key: string]: string } = {
            province: 'จังหวัด',
            district: 'อำเภอ',
            subdistrict: 'ตำบล',
            poi: 'สถานที่',
            'transport-kamphaeng-phet-4k': 'เลขระวาง จังหวัดกำแพงเพชร (4k)',
            'transport-thailand': 'เลขระวาง ประเทศไทย (สปภ.)',
            'transport-kamphaeng-phet-25k': 'เลขระวาง จังหวัดกำแพงเพชร (25k)',
        };
        return labels[type] || type;
    }

    getTypeIcon(type: string): string {
        const icons: { [key: string]: string } = {
            province: 'cil-map',
            district: 'cil-map',
            subdistrict: 'cil-map',
            poi: 'cil-location-pin',
            'transport-kamphaeng-phet-4k': 'cil-pin',
            'transport-thailand': 'cil-pin',
            'transport-kamphaeng-phet-25k': 'cil-pin',
        };
        return icons[type] || 'cil-cursor';
    }

    selectSearchResult(event: any) {
        const result = event.value;
        if (!result) return;

        console.log('🎯 Selected result:', result);
        console.log('🎯 Result type:', result.type);
        console.log('🎯 Result typeLabel:', result.typeLabel);
        console.log('🎯 Is POI?', result.type === 'poi' || result.typeLabel === 'สถานที่');

        if (this.pinEntity) {
            this.viewer.entities.remove(this.pinEntity);
            this.pinEntity = null;
        }

        const isPOI = result.type === 'poi' || result.typeLabel === 'สถานที่';

        if (isPOI) {
            console.log('📍 Creating pin marker for POI');
            try {
                this.pinEntity = this.viewer.entities.add({
                    position: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude),
                    billboard: {
                        image: this.createPinIcon(),
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                        scale: 0.8,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                    label: {
                        text: result.name,
                        font: 'bold 14px sans-serif',
                        fillColor: Cesium.Color.fromCssColorString('#E74C3C'),
                        showBackground: false,
                        pixelOffset: new Cesium.Cartesian2(35, -15),
                        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                        verticalOrigin: Cesium.VerticalOrigin.CENTER,
                        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                    },
                });
                console.log('✅ Pin marker created successfully');
            } catch (error) {
                console.error('❌ Error creating pin marker:', error);
            }
        }

        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, isPOI ? 5000 : result.height),
            duration: 2,
        });

        console.log('Flying to:', result.name, result);
    }

    clearSearch() {
        this.searchQuery = null;
        this.suggestions = [];
        if (this.pinEntity) {
            this.viewer.entities.remove(this.pinEntity);
            this.pinEntity = null;
        }
    }

    // Advanced Search Methods
    toggleAdvancedSearch() {
        this.advancedSearchExpanded = !this.advancedSearchExpanded;
    }

    async searchTransportKamphaengPhet4k() {
        if (!this.transportKamphaengPhet4kSearchQuery || this.transportKamphaengPhet4kSearchQuery.trim().length === 0) {
            this.transportKamphaengPhet4kResults = [];
            return;
        }

        try {
            this.transportKamphaengPhet4kResults = await this.searchLayer(
                `${this.workspace}:transport-kamphaeng_phet_4k`,
                this.transportKamphaengPhet4kSearchQuery,
                'transport-kamphaeng-phet-4k',
                'MAPSHEET',
                'MAPSHEET'
            );
        } catch (error) {
            console.error('Transport Kamphaeng Phet 4k search error:', error);
            this.transportKamphaengPhet4kResults = [];
        }
    }

    async searchTransportThailand() {
        if (!this.transportThailandSearchQuery || this.transportThailandSearchQuery.trim().length === 0) {
            this.transportThailandResults = [];
            return;
        }

        try {
            this.transportThailandResults = await this.searchLayer(
                `${this.workspace}:transport-thailand`,
                this.transportThailandSearchQuery,
                'transport-thailand',
                'SHEET_ID',
                'SHEET_ID'
            );
        } catch (error) {
            console.error('Transport Thailand search error:', error);
            this.transportThailandResults = [];
        }
    }

    async searchTransportKamphaengPhet25k() {
        if (!this.transportKamphaengPhet25kSearchQuery || this.transportKamphaengPhet25kSearchQuery.trim().length === 0) {
            this.transportKamphaengPhet25kResults = [];
            return;
        }

        try {
            this.transportKamphaengPhet25kResults = await this.searchLayer(
                `${this.workspace}:transport-kamphaeng_phet_25k`,
                this.transportKamphaengPhet25kSearchQuery,
                'transport-kamphaeng-phet-25k',
                'MAPSHEET',
                'MAPSHEET'
            );
        } catch (error) {
            console.error('Transport Kamphaeng Phet 25k search error:', error);
            this.transportKamphaengPhet25kResults = [];
        }
    }

    selectParcelResult(event: any) {
        const result = event.value || event;
        if (!result) return;

        console.log('🎯 Selected parcel:', result);

        // Remove previous pin if exists
        if (this.pinEntity) {
            this.viewer.entities.remove(this.pinEntity);
            this.pinEntity = null;
        }

        // Create pin marker
        this.pinEntity = this.viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude),
            billboard: {
                image: this.createPinIcon(),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                scale: 0.8,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
                text: String(result.name || 'Selected Location'),
                font: 'bold 14px sans-serif',
                fillColor: Cesium.Color.fromCssColorString('#E74C3C'),
                showBackground: false,
                pixelOffset: new Cesium.Cartesian2(35, -15),
                horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });

        // Determine fly height based on transport type
        let flyHeight = 100000; // Default 100km
        if (result.type === 'transport-thailand') {
            flyHeight = 200000; // ประเทศไทย (สปภ.) - 200km
        } else if (result.type === 'transport-kamphaeng-phet-4k') {
            flyHeight = 100000; // กำแพงเพชร (4k) - 100km
        } else if (result.type === 'transport-kamphaeng-phet-25k') {
            flyHeight = 150000; // กำแพงเพชร (25k) - 150km
        }

        // Fly to location
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, flyHeight),
            duration: 2,
        });
    }

    private createPinIcon(): string {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        ctx.fillStyle = '#FF4444';
        ctx.beginPath();
        ctx.moveTo(24, 64);
        ctx.bezierCurveTo(24, 64, 0, 40, 0, 24);
        ctx.bezierCurveTo(0, 10.7, 10.7, 0, 24, 0);
        ctx.bezierCurveTo(37.3, 0, 48, 10.7, 48, 24);
        ctx.bezierCurveTo(48, 40, 24, 64, 24, 64);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(24, 24, 8, 0, Math.PI * 2);
        ctx.fill();

        return canvas.toDataURL();
    }

    ngOnDestroy(): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        if (this.cameraChangeListener) {
            this.cameraChangeListener();
            this.cameraChangeListener = null;
        }
        this.viewer?.destroy();
        if (this.handler) {
            this.handler.destroy();
        }
    }

    setupInteraction() {
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

        this.handler.setInputAction(async (movement: any) => {
            const ray = this.viewer.camera.getPickRay(movement.position);
            if (!ray) return;

            const pickedFeatures = this.viewer.imageryLayers.pickImageryLayerFeatures(ray, this.viewer.scene);

            if (!Cesium.defined(pickedFeatures)) {
                this.selectedFeature = null;
                return;
            }

            try {
                const features = await Promise.resolve(pickedFeatures);

                if (features && features.length > 0) {
                    const feature: any = features[0];

                    let properties = feature.properties;
                    if (!properties && feature.data && feature.data.properties) {
                        properties = feature.data.properties;
                    } else if (!properties && feature.data) {
                        properties = feature.data;
                    }

                    // Detect layer type from imageryLayer
                    let featureType = 'unknown';
                    if (feature.imageryLayer) {
                        const layerName = feature.imageryLayer._imageryProvider?._layers || '';
                        if (layerName.includes('transport-kamphaeng_phet_4k')) {
                            featureType = 'transport-kamphaeng-phet-4k';
                        } else if (layerName.includes('transport-kamphaeng_phet_25k')) {
                            featureType = 'transport-kamphaeng-phet-25k';
                        } else if (layerName.includes('transport-thailand')) {
                            featureType = 'transport-thailand';
                        } else if (layerName.includes('thailand-changwat')) {
                            featureType = 'province';
                        } else if (layerName.includes('thailand-amphoe')) {
                            featureType = 'district';
                        } else if (layerName.includes('thailand-tambon')) {
                            featureType = 'subdistrict';
                        } else if (layerName.includes('pois')) {
                            featureType = 'poi';
                        }
                    }

                    this.selectedFeature = {
                        properties: properties || {},
                        name: feature.name,
                        type: featureType,
                    };
                    this.modalVisible = true;
                } else {
                    this.selectedFeature = null;
                }
            } catch (error) {
                console.error('❌ Error picking features:', error);
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    handleModalChange(event: boolean) {
        this.modalVisible = event;
    }

    closeModal() {
        this.modalVisible = false;
    }

    getLabel(key: any): string {
        return this.fieldLabels[String(key)] || String(key);
    }

    getDisplayItems(): { key: string; value: any; label: string }[] {
        if (!this.selectedFeature?.properties) return [];

        const entries = Object.entries(this.selectedFeature.properties).map(([key, value]) => ({
            key,
            value,
            label: this.getLabel(key),
        }));
        return entries.sort((a, b) => {
            if (a.key === 'Area_km2_') return 1;
            if (b.key === 'Area_km2_') return -1;
            return 0;
        });
    }

    // Shopping Cart Methods
    toggleCart() {
        this.cartCollapsed = !this.cartCollapsed;
    }

    addToCart(feature: any) {
        // Check if already in cart
        const exists = this.selectedParcels.find((p) => JSON.stringify(p.properties) === JSON.stringify(feature.properties));

        if (!exists) {
            // Add layerName based on type
            const layerNames: { [key: string]: string } = {
                'transport-kamphaeng-phet-4k': 'transport-kamphaeng_phet_4k',
                'transport-thailand': 'transport-thailand',
                'transport-kamphaeng-phet-25k': 'transport-kamphaeng_phet_25k',
            };
            const layerName = layerNames[feature.type] || 'unknown';
            const featureId = feature.properties?.fid || feature.properties?.FID || feature.properties?.MAPSHEET || Math.floor(Math.random() * 10000);

            feature.layerName = `${layerName}.${featureId}`;

            this.selectedParcels.push(feature);
            this.highlightParcel(feature);
            console.log('📦 Added to cart:', feature);

            // Save to localStorage
            this.saveCartToStorage();
        }
    }

    removeFromCart(index: number) {
        if (index >= 0 && index < this.selectedParcels.length) {
            const removed = this.selectedParcels.splice(index, 1)[0];
            this.removeParcelHighlight(index);
            console.log('🗑️ Removed from cart:', removed);

            // Save to localStorage
            this.saveCartToStorage();
        }
    }

    clearCart() {
        this.selectedParcels = [];
        this.clearAllHighlights();
        console.log('🗑️ Cart cleared');

        // Save to localStorage
        this.saveCartToStorage();
    }

    // Checkout Modal Methods
    openCheckoutModal() {
        if (this.selectedParcels.length === 0) {
            alert('ไม่มีรายการในตะกร้า');
            return;
        }
        this.checkoutModalVisible = true;
    }

    handleCheckoutModalChange(event: boolean) {
        this.checkoutModalVisible = event;
    }

    confirmOrder() {
        const totalItems = this.selectedParcels.length;
        const totalPrice = (totalItems * 10000).toLocaleString();

        // Close modal and clear cart first
        this.checkoutModalVisible = false;
        this.clearCart();

        // Show SweetAlert2 after modal closes
        // setTimeout(() => {
        Swal.fire({
            icon: 'success',
            title: 'ชำระเงินสำเร็จ!',
            html: `
                    <div style="text-align: left; padding: 10px;">
                        <p><strong>จำนวน:</strong> ${totalItems} รายการ</p>
                        <p><strong>ราคารวม:</strong> ฿${totalPrice}</p>
                    </div>
                    <p style="color: #28a745; font-weight: bold;">ขอบคุณสำหรับการสั่งซื้อ</p>
                `,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#28a745',
        });
        // }, 300);
    }

    getParcelTypeName(type: string): string {
        const typeNames: { [key: string]: string } = {
            'transport-kamphaeng-phet-4k': 'จังหวัดกำแพงเพชร (4k)',
            'transport-thailand': 'ประเทศไทย (สปภ.)',
            'transport-kamphaeng-phet-25k': 'จังหวัดกำแพงเพชร (25k)',
        };
        return typeNames[type] || type;
    }

    exportCart() {
        const data = this.selectedParcels.map((p) => p.properties);
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `parcel-cart-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        console.log('📥 Cart exported');
    }

    private highlightParcel(feature: any) {
        // Create a highlighted entity for the selected parcel
        // This would require the geometry data from the feature
        // For now, we'll just add a marker at the centroid
        if (feature.geometry && feature.geometry.coordinates) {
            const coords = feature.geometry.coordinates;
            let longitude = 0;
            let latitude = 0;

            if (feature.geometry.type === 'Point') {
                [longitude, latitude] = coords;
            } else if (feature.geometry.type === 'Polygon') {
                const polyCoords = coords[0];
                longitude = polyCoords.reduce((sum: number, c: any) => sum + c[0], 0) / polyCoords.length;
                latitude = polyCoords.reduce((sum: number, c: any) => sum + c[1], 0) / polyCoords.length;
            } else if (feature.geometry.type === 'MultiPolygon') {
                const polyCoords = coords[0][0];
                longitude = polyCoords.reduce((sum: number, c: any) => sum + c[0], 0) / polyCoords.length;
                latitude = polyCoords.reduce((sum: number, c: any) => sum + c[1], 0) / polyCoords.length;
            }

            const entity = this.viewer.entities.add({
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
                billboard: {
                    image: this.createCartIcon(),
                    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                    scale: 0.6,
                    heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                },
            });

            this.selectedParcelEntities.push(entity);
        }
    }

    private removeParcelHighlight(index: number) {
        if (index >= 0 && index < this.selectedParcelEntities.length) {
            const entity = this.selectedParcelEntities[index];
            if (entity) {
                this.viewer.entities.remove(entity);
            }
            this.selectedParcelEntities.splice(index, 1);
        }
    }

    private clearAllHighlights() {
        this.selectedParcelEntities.forEach((entity) => {
            if (entity) {
                this.viewer.entities.remove(entity);
            }
        });
        this.selectedParcelEntities = [];
    }

    private createCartIcon(): string {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Draw shopping cart icon
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(16, 16, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', 16, 16);

        return canvas.toDataURL();
    }

    private saveCartToStorage() {
        try {
            const cartData = this.selectedParcels.map((p) => p.properties);
            localStorage.setItem('map_parcel_cart', JSON.stringify(cartData));
        } catch (error) {
            console.error('Error saving cart to localStorage:', error);
        }
    }

    private loadCartFromStorage() {
        try {
            const stored = localStorage.getItem('map_parcel_cart');
            if (stored) {
                const cartData = JSON.parse(stored);
                // Note: This would require re-fetching full feature data with geometry
                console.log('📦 Cart data loaded from storage:', cartData.length, 'items');
            }
        } catch (error) {
            console.error('Error loading cart from localStorage:', error);
        }
    }

    // =====================================================
    // PHASE 3: WATERMARK EXPORT METHODS
    // =====================================================

    /**
     * Export current map view as PNG image with watermark
     */
    async exportMapAsImage() {
        try {
            const cesiumContainer = document.querySelector('.cesium-viewer') as HTMLElement;
            if (!cesiumContainer) {
                alert('ไม่พบแผนที่');
                return;
            }

            // Capture map screenshot
            const canvas = await html2canvas(cesiumContainer, {
                useCORS: true,
                allowTaint: true,
                logging: false,
            });

            // Add watermark
            const watermarkedCanvas = this.addWatermarkToCanvas(canvas, 'IA Group company');

            // Download image
            watermarkedCanvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `transport-map-${new Date().getTime()}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                }
            });

            console.log('✅ Map exported successfully');
        } catch (error) {
            console.error('❌ Error exporting map:', error);
            alert('เกิดข้อผิดพลาดในการ export แผนที่');
        }
    }

    /**
     * Export current feature details as PDF with watermark
     */
    async exportFeatureAsPDF() {
        if (!this.selectedFeature) {
            alert('ไม่มีข้อมูลที่จะ export');
            return;
        }

        try {
            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();

            // Add diagonal watermark
            this.addWatermarkToPDF(pdf, 'IA Group company');

            // Header
            pdf.setFontSize(18);
            pdf.text('Demo Map - IA Group company', pageWidth / 2, 20, { align: 'center' });

            pdf.setFontSize(10);
            const dateStr = new Date().toLocaleDateString('th-TH');
            pdf.text(`Date: ${dateStr}`, pageWidth / 2, 28, { align: 'center' });

            // Feature title
            let yPosition = 45;
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            const title =
                this.selectedFeature.name || this.selectedFeature.properties?.MAPSHEET || this.selectedFeature.properties?.SHEET_ID || 'รายละเอียด';
            pdf.text(String(title), pageWidth / 2, yPosition, { align: 'center' });

            // Details table
            yPosition += 15;
            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');

            const displayItems = this.getDisplayItems();
            displayItems.forEach((item) => {
                pdf.setFont('helvetica', 'bold');
                pdf.text(`${item.label}:`, 20, yPosition);
                pdf.setFont('helvetica', 'normal');
                pdf.text(String(item.value), 80, yPosition);
                yPosition += 8;
            });

            // Save PDF
            pdf.save(`feature-details-${new Date().getTime()}.pdf`);
            console.log('✅ Feature PDF exported successfully');
        } catch (error) {
            console.error('❌ Error exporting feature PDF:', error);
            alert('เกิดข้อผิดพลาดในการ export PDF');
        }
    }

    /**
     * Export shopping cart as PDF with watermark
     */
    async exportCartAsPDF() {
        if (this.selectedParcels.length === 0) {
            alert('ไม่มีรายการในตะกร้า');
            return;
        }

        try {
            const pdf = new jsPDF();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Add diagonal watermark to each page
            this.addWatermarkToPDF(pdf, 'IA Group company');

            // Header
            pdf.setFontSize(18);
            pdf.text('Demo Map - IA Group company', pageWidth / 2, 20, { align: 'center' });

            pdf.setFontSize(10);
            const dateStr = new Date().toLocaleDateString('th-TH');
            pdf.text(`Date: ${dateStr}`, pageWidth / 2, 28, { align: 'center' });

            // Table header
            let yPosition = 40;
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text('#', 15, yPosition);
            pdf.text('Parcel ID', 30, yPosition);
            pdf.text('Layer', 90, yPosition);
            pdf.text('Area', 130, yPosition);

            // Draw line under header
            pdf.line(15, yPosition + 2, pageWidth - 15, yPosition + 2);
            yPosition += 10;

            // Table content
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);

            this.selectedParcels.forEach((parcel, index) => {
                // Check if need new page
                if (yPosition > pageHeight - 30) {
                    pdf.addPage();
                    this.addWatermarkToPDF(pdf, 'IA Group company');
                    yPosition = 20;
                }

                const parcelId = parcel.properties?.MAPSHEET || parcel.properties?.SHEET_ID || `Parcel ${index + 1}`;
                const layer = parcel.type === 'transport-kamphaeng-phet-4k' ? 'กำแพงเพชร' : 'ประเทศไทย';
                const area = parcel.properties?.AREA || 'N/A';

                pdf.text(`${index + 1}`, 15, yPosition);
                pdf.text(String(parcelId), 30, yPosition);
                pdf.text(layer, 90, yPosition);
                pdf.text(String(area), 130, yPosition);

                yPosition += 8;
            });

            // Footer
            pdf.line(15, yPosition + 5, pageWidth - 15, yPosition + 5);
            yPosition += 15;
            pdf.setFontSize(12);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Total: ${this.selectedParcels.length} parcel(s)`, 15, yPosition);

            // Save PDF
            pdf.save(`transport-parcels-${new Date().getTime()}.pdf`);
            console.log('✅ PDF exported successfully');
        } catch (error) {
            console.error('❌ Error exporting PDF:', error);
            alert('เกิดข้อผิดพลาดในการ export PDF');
        }
    }

    /**
     * Add watermark to canvas
     */
    private addWatermarkToCanvas(sourceCanvas: HTMLCanvasElement, watermarkText: string): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return sourceCanvas;

        // Draw original image
        ctx.drawImage(sourceCanvas, 0, 0);

        // Add watermark
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Diagonal watermark pattern
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 4);

        const textWidth = ctx.measureText(watermarkText).width;
        const spacing = textWidth + 100;

        for (let x = -canvas.width; x < canvas.width; x += spacing) {
            for (let y = -canvas.height; y < canvas.height; y += 150) {
                ctx.fillText(watermarkText, x, y);
            }
        }

        ctx.restore();

        // Add bottom-right watermark
        ctx.globalAlpha = 0.5;
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(watermarkText, canvas.width - 150, canvas.height - 30);

        return canvas;
    }

    /**
     * Add diagonal watermark to PDF - Multiple repeating pattern
     */
    private addWatermarkToPDF(pdf: jsPDF, watermarkText: string) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.saveGraphicsState();
        // @ts-ignore - jsPDF GState typing issue
        pdf.setGState(new pdf.GState({ opacity: 0.15 })); // Increased opacity from 0.1 to 0.15
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(24); // Smaller watermark text

        // Create repeating diagonal watermark pattern
        const spacing = 80; // Spacing between watermarks

        // Rotate and repeat watermark across entire page
        for (let x = -pageWidth; x < pageWidth * 2; x += spacing) {
            for (let y = -pageHeight; y < pageHeight * 2; y += spacing) {
                pdf.text(watermarkText, x, y, {
                    align: 'center',
                    angle: 45,
                });
            }
        }

        pdf.restoreGraphicsState();
    }
}
