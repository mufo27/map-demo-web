import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule, ButtonModule, CardModule, GridModule, TableModule } from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { cilMap, cilLocationPin, cilPin, cilBuilding, cilCursor, cilChevronRight, cilChevronBottom, cilFilter } from '@coreui/icons';
import { AutoCompleteModule } from 'primeng/autocomplete';
import * as Cesium from 'cesium';

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
        };
    }

    private layers = {
        openStreetMap: null as Cesium.ImageryLayer | null,
        googleSatellite: null as Cesium.ImageryLayer | null,
        provinceBoundaries: null as Cesium.ImageryLayer | null,
        districtBoundaries: null as Cesium.ImageryLayer | null,
        subDistrictBoundaries: null as Cesium.ImageryLayer | null,
        roads: null as Cesium.ImageryLayer | null,
        railways: null as Cesium.ImageryLayer | null,
        waterways: null as Cesium.ImageryLayer | null,
        pois: null as Cesium.ImageryLayer | null,
        buildings: null as Cesium.ImageryLayer | null,
        parcel1: null as Cesium.ImageryLayer | null,
        parcel2: null as Cesium.ImageryLayer | null,

        openStreetMapSelf: null as Cesium.ImageryLayer | null,
    };

    layerControls = {
        openStreetMap: false,
        googleSatellite: false,
        provinceBoundaries: false,
        districtBoundaries: false,
        subDistrictBoundaries: false,
        roads: false,
        railways: false,
        waterways: false,
        pois: false,
        buildings: false,
        parcel1: false,
        parcel2: false,
        openStreetMapSelf: false,
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
        tier3: true,
        tier4: true,
    };

    panelCollapsed = true;

    searchQuery: any;
    suggestions: any[] = [];
    searchTimeout: any;

    // Advanced search
    advancedSearchExpanded = false;
    parcel1SearchQuery = '';
    parcel2SearchQuery = '';
    parcel1Results: any[] = [];
    parcel2Results: any[] = [];

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
    private selectedParcelEntities: Cesium.Entity[] = [];

    // Zoom level thresholds (in meters) - Based on camera height from globe
    private zoomLevels = {
        country: 2000000, // ~2000 km - Province level (minLevel: 0, maxLevel: 6)
        region: 500000, // ~500 km - District level (minLevel: 6, maxLevel: 9)
        city: 100000, // ~100 km - Sub-district level (minLevel: 9, maxLevel: 12)
        parcel1: Number.POSITIVE_INFINITY, // Kamphaeng Phet: Always show when enabled (no zoom limit)
        parcel2: Number.POSITIVE_INFINITY, // Thailand: Always show when enabled (no zoom limit)
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
        // Zoom levels based on camera height:
        // Province: > 2000km (minLevel: 0, maxLevel: 6)
        // District: 500-2000km (minLevel: 6, maxLevel: 9)
        // Sub-district: 100-500km (minLevel: 9, maxLevel: 12)
        // Roads/Railways/Waterways: < 20km (minLevel: 12, maxLevel: 15)
        // POIs: < 5km (minLevel: 15, maxLevel: 18)
        // Buildings: < 1km (minLevel: 18, maxLevel: 21)

        const showProvince = cameraHeight > this.zoomLevels.country;
        const showDistrict = cameraHeight <= this.zoomLevels.country && cameraHeight > this.zoomLevels.region;
        const showSubDistrict = cameraHeight <= this.zoomLevels.region && cameraHeight > this.zoomLevels.city;

        // Province: Show at country level (>2000km) AND when checkbox enabled
        if (this.layers.provinceBoundaries) {
            this.layers.provinceBoundaries.show = showProvince && this.layerControls.provinceBoundaries;
        }

        // District: Show at region level (500-2000km) AND when checkbox enabled
        if (this.layers.districtBoundaries) {
            this.layers.districtBoundaries.show = showDistrict && this.layerControls.districtBoundaries;
        }

        // Sub-district: Show at city level (100-500km) AND when checkbox enabled
        if (this.layers.subDistrictBoundaries) {
            this.layers.subDistrictBoundaries.show = showSubDistrict && this.layerControls.subDistrictBoundaries;
        }

        // Other layers respect tier controls AND user checkboxes
        if (this.tierControls.tier3) {
            // Parcel Layer 1 - Kamphaeng Phet: Independent zoom control
            if (this.layers.parcel1) {
                this.layers.parcel1.show = this.tierControls.tier3 && cameraHeight < this.zoomLevels.parcel1 && this.layerControls.parcel1;
            }

            // Parcel Layer 2 - Thailand: Independent zoom control
            if (this.layers.parcel2) {
                this.layers.parcel2.show = this.tierControls.tier3 && cameraHeight < this.zoomLevels.parcel2 && this.layerControls.parcel2;
            }
        } else {
            // Hide parcel layers when Tier 3 is disabled
            if (this.layers.parcel1) {
                this.layers.parcel1.show = false;
            }
            if (this.layers.parcel2) {
                this.layers.parcel2.show = false;
            }
        }

        if (this.tierControls.tier3) {
            // Roads, Railways and Waterways: Show when < 20 km (minLevel: 12, maxLevel: 15)
            if (this.layers.roads) {
                this.layers.roads.show = cameraHeight < this.zoomLevels.roads && this.layerControls.roads;
            }
            if (this.layers.railways) {
                this.layers.railways.show = cameraHeight < this.zoomLevels.roads && this.layerControls.railways;
            }
            if (this.layers.waterways) {
                this.layers.waterways.show = cameraHeight < this.zoomLevels.roads && this.layerControls.waterways;
            }

            // POI: Show when < 5 km (minLevel: 15, maxLevel: 18)
            if (this.layers.pois) {
                this.layers.pois.show = cameraHeight < this.zoomLevels.neighborhood && this.layerControls.pois;
            }
        }

        // Buildings: Show when < 1 km (minLevel: 18, maxLevel: 21)
        if (this.tierControls.tier4 && this.layers.buildings) {
            this.layers.buildings.show = cameraHeight < this.zoomLevels.street && this.layerControls.buildings;
        }

        console.log(`📏 Zoom updated: ${(cameraHeight / 1000).toFixed(1)} km`);
    }

    setupTier2_Imagery() {
        console.log('✓ Tier 2: Using Cesium default base map (Bing Maps)');

        try {
            const provider = new Cesium.OpenStreetMapImageryProvider({
                url: 'https://a.tile.openstreetmap.org/',
            });
            this.layers.openStreetMap = this.viewer.imageryLayers.addImageryProvider(provider);
            this.layers.openStreetMap.show = this.layerControls.openStreetMap;
            this.viewer.imageryLayers.raiseToTop(this.layers.openStreetMap);
            console.log('✓ Tier 2: OpenStreetMap loaded (optional)');
        } catch (error) {
            console.error('✗ Error loading OSM:', error);
        }

        try {
            const provider = new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                credit: 'Google Maps Satellite',
            });
            this.layers.googleSatellite = this.viewer.imageryLayers.addImageryProvider(provider);
            this.layers.googleSatellite.show = this.layerControls.googleSatellite;
            this.viewer.imageryLayers.raiseToTop(this.layers.googleSatellite);
            console.log('✓ Tier 2: Google Maps Satellite loaded');
        } catch (error) {
            console.error('✗ Error loading Google Maps:', error);
        }
    }

    setupTier3_VectorFeatures() {
        const wmsUrl = `${this.geoserverUrl}/wms`;

        this.layers.openStreetMapSelf = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand`, 'Open Street Map (Self)', 0);

        this.layers.waterways = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_waterways`, 'Waterways', 1);

        this.layers.railways = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_railways`, 'Railways', 2);

        this.layers.roads = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_roads`, 'Roads', 3);

        this.layers.provinceBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:th_province`, 'Province Boundaries', 4);

        this.layers.districtBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand-amphoe`, 'District Boundaries', 5);

        this.layers.subDistrictBoundaries = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand-tambon`, 'SubDistrict Boundaries', 6);

        this.layers.pois = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_pois`, 'POIs (Points of Interest)', 7);

        this.layers.buildings = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_buildings_a`, 'Buildings', 8);

        // Parcel layers (เลขระวาง) - Kamphaeng Phet on top to show detail in overlap area
        this.layers.parcel2 = this.addWMSLayer(wmsUrl, `${this.workspace}:transport-thailand`, 'ประเทศไทย (เลขระวาง 2)', 9);

        this.layers.parcel1 = this.addWMSLayer(wmsUrl, `${this.workspace}:transport-kamphaeng_phet_4k`, 'กำแพงเพชร (เลขระวาง 1)', 11);
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

    toggleOpenStreetMap() {
        if (this.layers.openStreetMap) {
            this.layers.openStreetMap.show = this.layerControls.openStreetMap;
        }
    }

    toggleGoogleSatellite() {
        if (this.layers.googleSatellite) {
            this.layers.googleSatellite.show = this.layerControls.googleSatellite;
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

    toggleParcel1() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleParcel2() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleOpenStreetMapSelf() {
        if (this.layers.openStreetMapSelf) {
            this.layers.openStreetMapSelf.show = this.layerControls.openStreetMapSelf;
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

    // Tier 2: Toggle all Imagery layers
    toggleTier2() {
        this.layerControls.openStreetMap = this.tierControls.tier2;
        this.layerControls.googleSatellite = this.tierControls.tier2;
        this.layerControls.openStreetMapSelf = this.tierControls.tier2;

        this.toggleOpenStreetMap();
        this.toggleGoogleSatellite();
        this.toggleOpenStreetMapSelf();
    }

    // Toggle Tier 2 collapse/expand
    toggleTier2Collapse() {
        this.tierCollapsed.tier2 = !this.tierCollapsed.tier2;
    }

    // Tier 3: Toggle all Vector/Features layers
    toggleTier3() {
        this.layerControls.provinceBoundaries = this.tierControls.tier3;
        this.layerControls.districtBoundaries = this.tierControls.tier3;
        this.layerControls.subDistrictBoundaries = this.tierControls.tier3;
        this.layerControls.roads = this.tierControls.tier3;
        this.layerControls.railways = this.tierControls.tier3;
        this.layerControls.waterways = this.tierControls.tier3;
        this.layerControls.pois = this.tierControls.tier3;
        this.layerControls.parcel1 = this.tierControls.tier3;
        this.layerControls.parcel2 = this.tierControls.tier3;

        this.toggleProvinceBoundaries();
        this.toggleDistrictBoundaries();
        this.toggleSubDistrictBoundaries();
        this.toggleRoads();
        this.toggleRailways();
        this.toggleWaterways();
        this.togglePOIs();
        this.toggleParcel1();
        this.toggleParcel2();
    }

    // Toggle Tier 3 collapse/expand
    toggleTier3Collapse() {
        this.tierCollapsed.tier3 = !this.tierCollapsed.tier3;
    }

    // Tier 4: Toggle 3D Tiles/Buildings
    toggleTier4() {
        this.layerControls.buildings = this.tierControls.tier4;
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
            parcel1: 'เลขระวาง 1',
            parcel2: 'เลขระวาง 2',
        };
        return labels[type] || type;
    }

    getTypeIcon(type: string): string {
        const icons: { [key: string]: string } = {
            province: 'cil-map',
            district: 'cil-map',
            subdistrict: 'cil-map',
            poi: 'cil-location-pin',
            parcel1: 'cil-pin',
            parcel2: 'cil-pin',
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

    async searchParcel1() {
        if (!this.parcel1SearchQuery || this.parcel1SearchQuery.trim().length === 0) {
            this.parcel1Results = [];
            return;
        }

        try {
            this.parcel1Results = await this.searchLayer(
                `${this.workspace}:transport-kamphaeng_phet_4k`,
                this.parcel1SearchQuery,
                'parcel1',
                'MAPSHEET',
                'MAPSHEET'
            );
        } catch (error) {
            console.error('Parcel 1 search error:', error);
            this.parcel1Results = [];
        }
    }

    async searchParcel2() {
        if (!this.parcel2SearchQuery || this.parcel2SearchQuery.trim().length === 0) {
            this.parcel2Results = [];
            return;
        }

        try {
            this.parcel2Results = await this.searchLayer(
                `${this.workspace}:transport-thailand`,
                this.parcel2SearchQuery,
                'parcel2',
                'SHEET_ID',
                'SHEET_ID'
            );
        } catch (error) {
            console.error('Parcel 2 search error:', error);
            this.parcel2Results = [];
        }
    }

    selectParcelResult(result: any) {
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

        // Fly to location
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, 5000),
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
                            featureType = 'parcel1';
                        } else if (layerName.includes('transport-thailand')) {
                            featureType = 'parcel2';
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
}
