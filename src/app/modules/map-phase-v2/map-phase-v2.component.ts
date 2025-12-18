import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule, ButtonModule, CardModule, GridModule, TableModule } from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { cilMap, cilLocationPin, cilPin, cilBuilding, cilCursor, cilChevronRight, cilChevronBottom } from '@coreui/icons';
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
        };
    }

    private layers = {
        openStreetMap: null as Cesium.ImageryLayer | null,
        googleSatellite: null as Cesium.ImageryLayer | null,

        // Tier 3 - Vector layers (DataSource)
        provinceBoundaries: null as Cesium.GeoJsonDataSource | null,
        districtBoundaries: null as Cesium.GeoJsonDataSource | null,
        subDistrictBoundaries: null as Cesium.GeoJsonDataSource | null,
        roads: null as Cesium.GeoJsonDataSource | null,
        waterways: null as Cesium.GeoJsonDataSource | null,
        pois: null as Cesium.GeoJsonDataSource | null,

        // Tier 4 - Buildings (still WMS for now)
        buildings: null as Cesium.ImageryLayer | null,
        openStreetMapSelf: null as Cesium.ImageryLayer | null,
    };

    // Track which layers have been loaded (for lazy loading optimization)
    private loadedLayers = new Set<string>();
    private loadingLayers = new Set<string>();

    layerControls = {
        openStreetMap: false,
        googleSatellite: false,
        provinceBoundaries: false,
        districtBoundaries: false,
        subDistrictBoundaries: false,
        roads: false,
        waterways: false,
        pois: false,
        buildings: false,
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

    selectedFeature: any = null;
    modalVisible = false;
    private handler: Cesium.ScreenSpaceEventHandler | null = null;
    private pinEntity: Cesium.Entity | null = null;
    private cameraChangeListener: any = null;
    private lastCameraHeight: number = 0;
    currentCameraHeight: number = 2000000;

    // Zoom level thresholds (in meters) - Aligned with Google Maps
    private zoomLevels = {
        country: 300000, // 300 km - Province level (Zoom 5-7)
        region: 75000, // 75 km - District level (Zoom 8-10)
        city: 10000, // 10 km - Sub-district level (Zoom 11-13)
        neighborhood: 2500, // 2.5 km - POI level (Zoom 16+)
        street: 1000, // 1 km - Building level (Zoom 18+) + OSM Self
    };

    // Predefined zoom presets for quick navigation

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
        // Google Maps aligned zoom levels:
        // Province: > 300km (Zoom 5-7)
        // District: 75-300km (Zoom 8-10)
        // Sub-district: 10-75km (Zoom 11-13)
        // Roads/Waterways: < 10km (Zoom 14+)
        // POIs: < 2.5km (Zoom 16+)
        // Buildings/OSM: < 1km (Zoom 18+)

        const showProvince = cameraHeight > this.zoomLevels.country;
        const showDistrict = cameraHeight <= this.zoomLevels.country && cameraHeight > this.zoomLevels.region;
        const showSubDistrict = cameraHeight <= this.zoomLevels.region && cameraHeight > this.zoomLevels.city;

        // Province: Auto-load and show at country level (>300km) AND when checkbox enabled
        if (showProvince && this.layerControls.provinceBoundaries) {
            if (!this.layers.provinceBoundaries) {
                this.loadVectorLayer('th_province', 'provinceBoundaries', 'Province Boundaries', '#FF6B6B', 2);
            } else {
                this.layers.provinceBoundaries.show = true;
            }
        } else if (this.layers.provinceBoundaries) {
            this.layers.provinceBoundaries.show = false;
        }

        // District: Auto-load and show at region level (75-300km) AND when checkbox enabled
        if (showDistrict && this.layerControls.districtBoundaries) {
            if (!this.layers.districtBoundaries) {
                this.loadVectorLayer('thailand-amphoe', 'districtBoundaries', 'District Boundaries', '#4ECDC4', 1.5);
            } else {
                this.layers.districtBoundaries.show = true;
            }
        } else if (this.layers.districtBoundaries) {
            this.layers.districtBoundaries.show = false;
        }

        // Sub-district: Auto-load and show at city level (10-75km) AND when checkbox enabled
        if (showSubDistrict && this.layerControls.subDistrictBoundaries) {
            if (!this.layers.subDistrictBoundaries) {
                this.loadVectorLayer('thailand-tambon', 'subDistrictBoundaries', 'SubDistrict Boundaries', '#95E1D3', 1);
            } else {
                this.layers.subDistrictBoundaries.show = true;
            }
        } else if (this.layers.subDistrictBoundaries) {
            this.layers.subDistrictBoundaries.show = false;
        }

        // Other layers respect tier controls AND user checkboxes
        if (this.tierControls.tier3) {
            // Roads and Waterways: Show when < 10 km (Zoom 14+)
            if (this.layers.roads) {
                this.layers.roads.show = cameraHeight < this.zoomLevels.city && this.layerControls.roads;
            }
            if (this.layers.waterways) {
                this.layers.waterways.show = cameraHeight < this.zoomLevels.city && this.layerControls.waterways;
            }

            // POI: Show when < 2.5 km (Zoom 16+)
            if (this.layers.pois) {
                this.layers.pois.show = cameraHeight < this.zoomLevels.neighborhood && this.layerControls.pois;
            }

            // OSM Self: Show when < 1 km (Zoom 18+)
            if (this.layers.openStreetMapSelf) {
                this.layers.openStreetMapSelf.show = cameraHeight < this.zoomLevels.street && this.layerControls.openStreetMapSelf;
            }
        }

        // Buildings: Show when < 1 km (Zoom 18+)
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
        console.log('✓ Tier 3: Vector layers configured (Lazy Loading enabled)');

        // Don't load vector layers immediately - they will load when user toggles them on
        // This significantly improves initial load time

        // Buildings and OSM Self remain as WMS (Tier 4)
        const wmsUrl = `${this.geoserverUrl}/wms`;
        this.layers.buildings = this.addWMSLayer(wmsUrl, `${this.workspace}:gis_osm_buildings_a`, 'Buildings', 7);
        this.layers.openStreetMapSelf = this.addWMSLayer(wmsUrl, `${this.workspace}:thailand`, 'Open Street Map (Self)', 0);
    }

    async loadVectorLayer(
        layerName: string,
        propertyName: keyof typeof this.layers,
        displayName: string,
        color: string,
        lineWidth: number = 2,
        isPoint: boolean = false
    ) {
        const layerKey = `${propertyName}`;

        // Prevent duplicate loading
        if (this.loadedLayers.has(layerKey) || this.loadingLayers.has(layerKey)) {
            console.log(`⏭️ ${displayName} already loaded/loading`);
            if (this.layers[propertyName]) {
                (this.layers[propertyName] as any).show = true;
            }
            return;
        }

        this.loadingLayers.add(layerKey);

        try {
            const wfsUrl = `${this.geoserverUrl}/wfs`;
            const params = new URLSearchParams({
                service: 'WFS',
                version: '2.0.0',
                request: 'GetFeature',
                typeName: `${this.workspace}:${layerName}`,
                outputFormat: 'application/json',
                srsName: 'EPSG:4326',
                maxFeatures: '2000', // Limit for performance
            });

            const url = `${wfsUrl}?${params.toString()}`;
            console.log(`🔄 Loading: ${displayName}...`);

            const dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString(color),
                strokeWidth: lineWidth,
                fill: Cesium.Color.fromCssColorString(color).withAlpha(0.1),
                markerColor: isPoint ? Cesium.Color.fromCssColorString(color) : undefined,
                markerSize: isPoint ? 8 : undefined,
                clampToGround: true,
            });

            dataSource.show = true;
            await this.viewer.dataSources.add(dataSource);

            (this.layers as any)[propertyName] = dataSource;
            this.loadedLayers.add(layerKey);
            this.loadingLayers.delete(layerKey);

            console.log(`✓ ${displayName} (${dataSource.entities.values.length} features)`);

            // Re-evaluate visibility in case user zoomed away while loading
            if (this.viewer && this.viewer.camera) {
                const currentHeight = this.viewer.camera.positionCartographic.height;
                this.updateLayerVisibilityByZoom(currentHeight);
            }
        } catch (error) {
            console.error(`✗ Error: ${displayName}`, error);
            this.loadingLayers.delete(layerKey);
        }
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

    toggleWaterways() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    togglePOIs() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    toggleOpenStreetMapSelf() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
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

        this.toggleOpenStreetMap();
        this.toggleGoogleSatellite();
    }

    // Toggle Tier 2 collapse/expand
    toggleTier2Collapse() {
        this.tierCollapsed.tier2 = !this.tierCollapsed.tier2;
    }

    // Tier 3: Toggle all Vector/Features layers (excluding openStreetMapSelf)
    toggleTier3() {
        this.layerControls.provinceBoundaries = this.tierControls.tier3;
        this.layerControls.districtBoundaries = this.tierControls.tier3;
        this.layerControls.subDistrictBoundaries = this.tierControls.tier3;
        this.layerControls.roads = this.tierControls.tier3;
        this.layerControls.waterways = this.tierControls.tier3;
        this.layerControls.pois = this.tierControls.tier3;
        this.layerControls.openStreetMapSelf = this.tierControls.tier3;

        this.toggleProvinceBoundaries();
        this.toggleDistrictBoundaries();
        this.toggleSubDistrictBoundaries();
        this.toggleRoads();
        this.toggleWaterways();
        this.togglePOIs();
        this.toggleOpenStreetMapSelf();
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
                const nameTh = props[thField] || '';
                const nameEn = props[enField] || '';
                const displayName = nameTh || nameEn;

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
        };
        return labels[type] || type;
    }

    getTypeIcon(type: string): string {
        const icons: { [key: string]: string } = {
            province: 'cil-map',
            district: 'cil-map',
            subdistrict: 'cil-map',
            poi: 'cil-location-pin',
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

        // Cleanup vector data sources
        if (this.viewer && this.viewer.dataSources) {
            this.viewer.dataSources.removeAll();
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

                    this.selectedFeature = {
                        properties: properties || {},
                        name: feature.name,
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
}
