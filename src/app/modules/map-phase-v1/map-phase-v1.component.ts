import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalModule, ButtonModule, CardModule, GridModule, TableModule } from '@coreui/angular';
import { IconModule, IconSetService } from '@coreui/icons-angular';
import { cilMap, cilLocationPin, cilPin, cilBuilding, cilCursor, cilChevronRight, cilChevronBottom } from '@coreui/icons';
import { AutoCompleteModule } from 'primeng/autocomplete';
import * as Cesium from 'cesium';

@Component({
    selector: 'app-map-phase-v1',
    standalone: true,
    imports: [CommonModule, FormsModule, ModalModule, ButtonModule, CardModule, GridModule, TableModule, AutoCompleteModule, IconModule],
    templateUrl: './map-phase-v1.component.html',
    styleUrl: './map-phase-v1.component.scss',
})
export class MapPhaseV1Component implements AfterViewInit, OnDestroy {
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

    // Imagery Layers (Raster/WMS)
    private layers = {
        openStreetMap: null as Cesium.ImageryLayer | null,
        googleSatellite: null as Cesium.ImageryLayer | null,
        openStreetMapSelf: null as Cesium.ImageryLayer | null,
        buildings: null as Cesium.ImageryLayer | null,
    };

    // Vector Data Sources (WFS/GeoJSON) for interactive features
    private vectorSources = {
        province: null as Cesium.GeoJsonDataSource | null,
        district: null as Cesium.GeoJsonDataSource | null,
        subDistrict: null as Cesium.GeoJsonDataSource | null,
        pois: null as Cesium.GeoJsonDataSource | null,
        roads: null as Cesium.GeoJsonDataSource | null,
        railways: null as Cesium.GeoJsonDataSource | null,
        waterways: null as Cesium.GeoJsonDataSource | null,
    };

    // Track which vector sources have been loaded
    private vectorSourcesLoaded = {
        province: false,
        district: false,
        subDistrict: false,
        pois: false,
        roads: false,
        railways: false,
        waterways: false,
    };

    layerControls = {
        openStreetMapSelf: false,
        openStreetMap: false,
        googleSatellite: false,
        roads: false,
        railways: false,
        waterways: false,

        provinceBoundaries: false,
        districtBoundaries: false,
        subDistrictBoundaries: false,
        pois: false,

        buildings: false,
    };

    // Tier controls for hierarchical layer management
    tierControls = {
        tier0: true, // Globe/Ellipsoid (default on)
        tier1: false, // Terrain/DEM
        tier2: false, // Imagery layers (default on)
        tier3: false, // Vector/Features layers (default on)
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
    currentCameraHeight: number = 2000000; // Default start height

    // Zoom level thresholds (in meters) - Based on camera height from globe
    private zoomLevels = {
        province: 2000000, // ~2000 km - Show provinces at country view (minLevel: 0, maxLevel: 6)
        district: 500000, // ~500 km - Show districts at regional view (minLevel: 6, maxLevel: 9)
        subDistrict: 100000, // ~100 km - Show sub-districts at city view (minLevel: 9, maxLevel: 12)
        waterways: 20000, // ~20 km - Show waterways at city+ view (minLevel: 12, maxLevel: 15)
        railways: 20000, // ~20 km - Show railways at city view (minLevel: 12, maxLevel: 15)
        roads: 20000, // ~20 km - Show roads at neighborhood view (minLevel: 12, maxLevel: 15)
        pois: 5000, // ~5 km - Show POIs at street view (minLevel: 15, maxLevel: 18)
        buildings: 1000, // ~1 km - Show buildings at very close view (minLevel: 18, maxLevel: 21)
    };

    // Field labels
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

    // After view init
    ngAfterViewInit(): void {
        (window as any).CESIUM_BASE_URL = '/assets/cesium/';
        this.initCesium();
    }

    // Init Cesium
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
        this.setupTier4_3DTiles();
        this.setupInteraction();
        this.setupCameraListener();

        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
        });
    }

    // Setup tier 0 globe
    setupTier0_Globe() {
        this.viewer.scene.globe.show = this.tierControls.tier0;
    }

    // Setup tier 1 terrain
    setupTier1_Terrain() {
        // Can be changed to use actual terrain server URL in the future
        this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }

    // Setup tier 2 imagery
    setupTier2_Imagery() {
        const wmsUrl = `${this.geoserverUrl}/wms`;

        // 1. OSM Self-hosted (WMS)
        this.layers.openStreetMapSelf = this.loadWMSLayer(wmsUrl, `${this.workspace}:thailand`, 'OSM Self', 0);
        if (this.layers.openStreetMapSelf) {
            this.layers.openStreetMapSelf.show = this.layerControls.openStreetMapSelf;
        }

        // 2. Google Satellite
        this.layers.googleSatellite = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
                url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                credit: 'Google Maps Satellite',
            })
        );
        this.layers.googleSatellite.show = this.layerControls.googleSatellite;

        // 3. OSM Public
        this.layers.openStreetMap = this.viewer.imageryLayers.addImageryProvider(
            new Cesium.OpenStreetMapImageryProvider({ url: 'https://a.tile.openstreetmap.org/' })
        );
        this.layers.openStreetMap.show = this.layerControls.openStreetMap;
    }

    // Setup tier 3 vector features
    setupTier3_VectorFeatures() {
        // All vector layers (roads, waterways, boundaries, POIs) will be loaded lazily when user enables them
    }

    // Setup tier 4 3D tiles/buildings
    setupTier4_3DTiles() {
        const wmsUrl = `${this.geoserverUrl}/wms`;
        this.layers.buildings = this.loadWMSLayer(wmsUrl, `${this.workspace}:gis_osm_buildings_a`, 'Buildings', 7);
    }

    // Load WFS vector data as GeoJSON (lazy loading)
    private async loadWFSVector(
        typeName: string,
        key: keyof typeof this.vectorSources,
        strokeColor: string = '#1a73e8',
        strokeWidth: number = 2,
        maxFeatures: number = 2000,
        fillColor: string = 'rgba(255, 255, 255, 0.01)'
    ) {
        // Skip if already loaded or currently loading (prevent race condition)
        if (this.vectorSourcesLoaded[key]) {
            console.log(`⏭️ Vector layer already loaded: ${key}`);
            return;
        }

        // Set flag immediately to prevent duplicate loading from concurrent calls
        this.vectorSourcesLoaded[key] = true;

        const url = `${this.geoserverUrl}/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=${typeName}&outputFormat=application/json&srsName=EPSG:4326&maxFeatures=${maxFeatures}`;
        const startTime = performance.now();

        try {
            // console.log(`🔄 [${key}] Starting to load vector layer from: ${typeName}`);
            // console.log(`📡 [${key}] WFS URL: ${url}`);

            const dataSource = await Cesium.GeoJsonDataSource.load(url, {
                stroke: Cesium.Color.fromCssColorString(strokeColor),
                fill: Cesium.Color.fromCssColorString(fillColor),
                strokeWidth: strokeWidth,
            });

            this.viewer.dataSources.add(dataSource);
            this.vectorSources[key] = dataSource;
            dataSource.show = false;

            const endTime = performance.now();
            const loadTime = ((endTime - startTime) / 1000).toFixed(2);
            const featureCount = dataSource.entities.values.length;

            console.log(`✅ [${key}] Vector layer loaded successfully!`);
            // console.log(`   📊 Features: ${featureCount}`);
            // console.log(`   ⏱️ Load time: ${loadTime}s`);
            // console.log(`   ✓ Status: Ready`);

            // Update visibility immediately after loading
            this.updateLayerVisibilityByZoom(this.currentCameraHeight);
        } catch (e) {
            const endTime = performance.now();
            const loadTime = ((endTime - startTime) / 1000).toFixed(2);

            // Reset flag on error to allow retry
            this.vectorSourcesLoaded[key] = false;

            console.error(`❌ [${key}] Failed to load WFS: ${typeName}`);
            console.error(`   ⏱️ Failed after: ${loadTime}s`);
            console.error(`   🔴 Error:`, e);
        }
    }

    // Load WMS layer Imagery
    private loadWMSLayer(url: string, layers: string, name: string, zIndex: number = 0): Cesium.ImageryLayer | null {
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

            return layer;
        } catch (error) {
            console.error(`✗ Error loading ${name}:`, error);
            return null;
        }
    }

    // Setup camera listener
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
    }

    // Update layer visibility by zoom (Google Maps style)
    updateLayerVisibilityByZoom(cameraHeight: number) {
        console.log(`📷 Camera Height: ${(cameraHeight / 1000).toFixed(2)} km (${cameraHeight.toFixed(0)} m)`);

        // Tier 3: Vector features (roads, waterways, POIs, boundaries)
        if (this.tierControls.tier3) {
            // Province Boundaries: Show at far zoom (country view) - Soft Purple
            if (this.layerControls.provinceBoundaries && cameraHeight > this.zoomLevels.province) {
                if (!this.vectorSourcesLoaded.province) {
                    this.loadWFSVector(
                        `${this.workspace}:th_province`,
                        'province',
                        '#E1BEE7', // Soft purple (Google Maps style)
                        1.5, // Thin line
                        1000,
                        'rgba(225, 190, 231, 0.08)' // Very subtle purple fill
                    );
                }
            }
            if (this.vectorSources.province) {
                const previousShow = this.vectorSources.province.show;
                const shouldShow = cameraHeight > this.zoomLevels.province && this.layerControls.provinceBoundaries;
                this.vectorSources.province.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`🗺️  Province Boundaries: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // District Boundaries: Show at medium zoom (regional view) - Soft Orange
            if (this.layerControls.districtBoundaries && cameraHeight <= this.zoomLevels.province && cameraHeight > this.zoomLevels.district) {
                if (!this.vectorSourcesLoaded.district) {
                    this.loadWFSVector(
                        `${this.workspace}:thailand-amphoe`,
                        'district',
                        '#FFE0B2', // Soft orange (Google Maps style)
                        1.2, // Thin line
                        2000,
                        'rgba(255, 224, 178, 0.06)' // Very subtle orange fill
                    );
                }
            }
            if (this.vectorSources.district) {
                const previousShow = this.vectorSources.district.show;
                const shouldShow =
                    cameraHeight <= this.zoomLevels.province && cameraHeight > this.zoomLevels.district && this.layerControls.districtBoundaries;
                this.vectorSources.district.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`🗺️  District Boundaries: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // Sub-district Boundaries: Show at close zoom (city view) - Very subtle gray
            if (this.layerControls.subDistrictBoundaries && cameraHeight <= this.zoomLevels.district && cameraHeight > this.zoomLevels.subDistrict) {
                if (!this.vectorSourcesLoaded.subDistrict) {
                    this.loadWFSVector(
                        `${this.workspace}:thailand-tambon`,
                        'subDistrict',
                        '#E0E0E0', // Very light gray (Google Maps style)
                        0.8, // Very thin line
                        3000,
                        'rgba(224, 224, 224, 0.04)' // Nearly transparent gray fill
                    );
                }
            }
            if (this.vectorSources.subDistrict) {
                const previousShow = this.vectorSources.subDistrict.show;
                const shouldShow =
                    cameraHeight <= this.zoomLevels.district &&
                    cameraHeight > this.zoomLevels.subDistrict &&
                    this.layerControls.subDistrictBoundaries;
                this.vectorSources.subDistrict.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`🗺️  Sub-district Boundaries: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // Waterways: Show at city+ zoom - Soft Aqua Blue (Google Maps style)
            if (this.layerControls.waterways && cameraHeight < this.zoomLevels.waterways) {
                if (!this.vectorSourcesLoaded.waterways) {
                    this.loadWFSVector(
                        `${this.workspace}:gis_osm_waterways`,
                        'waterways',
                        '#A8DADC', // Soft aqua blue (Google Maps water)
                        1.5,
                        5000,
                        'rgba(168, 218, 220, 0.15)' // Subtle water fill
                    );
                }
            }
            if (this.vectorSources.waterways) {
                const previousShow = this.vectorSources.waterways.show;
                const shouldShow = cameraHeight < this.zoomLevels.waterways && this.layerControls.waterways;
                this.vectorSources.waterways.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`💧 Waterways: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // Railways: Show at city+ zoom - Dark Rails (Google Maps style)
            if (this.layerControls.railways && cameraHeight < this.zoomLevels.railways) {
                if (!this.vectorSourcesLoaded.railways) {
                    this.loadWFSVector(
                        `${this.workspace}:gis_osm_railways`,
                        'railways',
                        '#757575', // Dark gray (Google Maps railway color)
                        2.5,
                        3000,
                        'rgba(117, 117, 117, 0.6)' // Medium gray fill
                    );
                }
            }
            if (this.vectorSources.railways) {
                const previousShow = this.vectorSources.railways.show;
                const shouldShow = cameraHeight < this.zoomLevels.railways && this.layerControls.railways;
                this.vectorSources.railways.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`🚂 Railways: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // Roads: Show at neighborhood zoom - Soft Gray (Google Maps style)
            if (this.layerControls.roads && cameraHeight < this.zoomLevels.roads) {
                if (!this.vectorSourcesLoaded.roads) {
                    this.loadWFSVector(
                        `${this.workspace}:gis_osm_roads`,
                        'roads',
                        '#BDBDBD', // Soft gray (Google Maps road color)
                        1.8,
                        5000,
                        'rgba(250, 250, 250, 0.7)' // Light gray fill
                    );
                }
            }
            if (this.vectorSources.roads) {
                const previousShow = this.vectorSources.roads.show;
                const shouldShow = cameraHeight < this.zoomLevels.roads && this.layerControls.roads;
                this.vectorSources.roads.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`🛣️  Roads: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }

            // POIs: Show at street zoom (very close) - Soft Red Marker
            if (this.layerControls.pois && cameraHeight < this.zoomLevels.pois) {
                if (!this.vectorSourcesLoaded.pois) {
                    this.loadWFSVector(
                        `${this.workspace}:gis_osm_pois`,
                        'pois',
                        '#EA4335', // Google Maps red
                        1.5,
                        2000,
                        'rgba(234, 67, 53, 0.12)' // Very subtle red fill
                    );
                }
            }
            if (this.vectorSources.pois) {
                const previousShow = this.vectorSources.pois.show;
                const shouldShow = cameraHeight < this.zoomLevels.pois && this.layerControls.pois;
                this.vectorSources.pois.show = shouldShow;
                if (shouldShow !== previousShow) {
                    console.log(`📍 POIs: ${shouldShow ? '✅ SHOW' : '❌ HIDE'}`);
                }
            }
        } else {
            // Hide all Tier 3 layers when tier is disabled
            if (this.vectorSources.roads) this.vectorSources.roads.show = false;
            if (this.vectorSources.railways) this.vectorSources.railways.show = false;
            if (this.vectorSources.waterways) this.vectorSources.waterways.show = false;
            if (this.vectorSources.province) this.vectorSources.province.show = false;
            if (this.vectorSources.district) this.vectorSources.district.show = false;
            if (this.vectorSources.subDistrict) this.vectorSources.subDistrict.show = false;
            if (this.vectorSources.pois) this.vectorSources.pois.show = false;
        }

        // Tier 4: Buildings (show at very close zoom)
        if (this.tierControls.tier4 && this.layers.buildings) {
            this.layers.buildings.show = cameraHeight < this.zoomLevels.buildings && this.layerControls.buildings;
        }
    }

    // Search
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

    // Search GeoServer
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

    // Search layer
    async searchLayer(layerName: string, query: string, type: string, thField: string, enField: string): Promise<any[]> {
        try {
            const wfsUrl = `${this.geoserverUrl}/wfs`;
            const filter = `${thField} LIKE '%${query}%' OR ${enField} LIKE '%${query}%'`;

            const params = new URLSearchParams({
                service: 'WFS',
                version: '2.0.0',
                request: 'GetFeature',
                typeName: layerName,
                outputFormat: 'application/json',
                CQL_FILTER: filter,
                maxFeatures: '5',
                srsName: 'EPSG:4326',
            });

            const fullUrl = `${wfsUrl}?${params.toString()}`;

            const response = await fetch(fullUrl);

            // Check if response is ok
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ WFS Error Response:', errorText);
                throw new Error(`WFS request failed: ${response.statusText}`);
            }

            // Parse response
            const data = await response.json();

            // Check if features exist
            if (!data.features || data.features.length === 0) {
                console.warn('⚠️ No features found for query:', query);
                return [];
            }

            // Map features to results
            return data.features.map((feature: any) => {
                // Get properties and geometry
                const props = feature.properties;
                // Get geometry
                const geometry = feature.geometry;

                let longitude = 0;
                let latitude = 0;
                let height = 50000;

                // Calculate center point
                if (geometry.type === 'Point') {
                    [longitude, latitude] = geometry.coordinates;

                    // Calculate center point of polygon
                } else if (geometry.type === 'Polygon') {
                    const coords = geometry.coordinates[0];
                    longitude = coords.reduce((sum: number, c: any) => sum + c[0], 0) / coords.length;
                    latitude = coords.reduce((sum: number, c: any) => sum + c[1], 0) / coords.length;
                    height = type === 'province' ? 200000 : 100000;

                    // Calculate center point of multi-polygon
                } else if (geometry.type === 'MultiPolygon') {
                    const coords = geometry.coordinates[0][0];
                    longitude = coords.reduce((sum: number, c: any) => sum + c[0], 0) / coords.length;
                    latitude = coords.reduce((sum: number, c: any) => sum + c[1], 0) / coords.length;
                    height = type === 'province' ? 200000 : 100000;
                }

                const nameTh = props[thField] || '';
                const nameEn = props[enField] || '';
                const displayName = nameTh || nameEn;

                // Return result
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

    // Select search result
    selectSearchResult(event: any) {
        // Get result
        const result = event.value;
        if (!result) return;

        // Remove previous pin
        if (this.pinEntity) {
            this.viewer.entities.remove(this.pinEntity);
            this.pinEntity = null;
        }

        // Check if result is POI
        const isPOI = result.type === 'poi' || result.typeLabel === 'สถานที่';

        // Add pin
        if (isPOI) {
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
            } catch (error) {
                console.error('❌ Error creating pin marker:', error);
            }
        }

        // Fly to result
        this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(result.longitude, result.latitude, isPOI ? 5000 : result.height),
            duration: 2,
        });
    }

    // Clear search
    clearSearch() {
        this.searchQuery = null;
        this.suggestions = [];
        if (this.pinEntity) {
            this.viewer.entities.remove(this.pinEntity);
            this.pinEntity = null;
        }
    }

    // Get type label
    getTypeLabel(type: string): string {
        const labels: { [key: string]: string } = {
            province: 'จังหวัด',
            district: 'อำเภอ',
            subdistrict: 'ตำบล',
            poi: 'สถานที่',
        };
        return labels[type] || type;
    }

    // Get type icon
    getTypeIcon(type: string): string {
        const icons: { [key: string]: string } = {
            province: 'cil-map',
            district: 'cil-map',
            subdistrict: 'cil-map',
            poi: 'cil-location-pin',
        };
        return icons[type] || 'cil-cursor';
    }

    // Create pin icon
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

    // Cleanup
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

    // Setup interaction
    setupInteraction() {
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

        this.handler.setInputAction(async (movement: any) => {
            // First, try to pick a vector entity (GeoJSON features)
            const pickedObject = this.viewer.scene.pick(movement.position);
            if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
                const entity = pickedObject.id;
                this.selectedFeature = { properties: entity.properties.getValue(Cesium.JulianDate.now()) };
                this.modalVisible = true;
                return;
            }

            // If no entity picked, try WMS feature picking
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

    // Handle modal change
    handleModalChange(event: boolean) {
        this.modalVisible = event;
    }

    // Get label
    getLabel(key: any): string {
        return this.fieldLabels[String(key)] || String(key);
    }

    // Get display items
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

    // Toggle panel collapse/expand
    togglePanel() {
        this.panelCollapsed = !this.panelCollapsed;
    }

    // Toggle Tier 0 collapse/expand
    toggleTier0Collapse() {
        this.tierCollapsed.tier0 = !this.tierCollapsed.tier0;
    }

    // Toggle Tier 1 collapse/expand
    toggleTier1Collapse() {
        this.tierCollapsed.tier1 = !this.tierCollapsed.tier1;
    }

    // Toggle Tier 2 collapse/expand
    toggleTier2Collapse() {
        this.tierCollapsed.tier2 = !this.tierCollapsed.tier2;
    }

    // Toggle Tier 3 collapse/expand
    toggleTier3Collapse() {
        this.tierCollapsed.tier3 = !this.tierCollapsed.tier3;
    }

    // Toggle Tier 4 collapse/expand
    toggleTier4Collapse() {
        this.tierCollapsed.tier4 = !this.tierCollapsed.tier4;
    }

    // Tier 0: Toggle Globe visibility
    toggleTier0() {
        if (this.viewer && this.viewer.scene) {
            this.viewer.scene.globe.show = this.tierControls.tier0;
        }
    }

    // Tier 1: Toggle Terrain layers
    toggleTier1() {}

    // Tier 2: Toggle all Imagery layers
    toggleTier2() {
        this.layerControls.openStreetMap = this.tierControls.tier2;
        this.layerControls.googleSatellite = this.tierControls.tier2;
        this.layerControls.openStreetMapSelf = this.tierControls.tier2;

        // Trigger toggle functions of layers inside
        this.toggleOpenStreetMap();
        this.toggleGoogleSatellite();
        this.toggleOpenStreetMapSelf();
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

        // Trigger lazy loading for vector layers
        this.toggleProvinceBoundaries();
        this.toggleDistrictBoundaries();
        this.toggleSubDistrictBoundaries();
        this.toggleRoads();
        this.toggleRailways();
        this.toggleWaterways();
        this.togglePOIs();
    }

    // Tier 4: Toggle 3D Tiles/Buildings
    toggleTier4() {
        this.layerControls.buildings = this.tierControls.tier4;

        // Trigger toggle function of layers inside
        this.toggleBuildings();
    }

    // Toggle OpenStreetMap layer
    toggleOpenStreetMap() {
        if (this.layers.openStreetMap) {
            this.layers.openStreetMap.show = this.layerControls.openStreetMap;
        }
    }

    // Toggle Google Satellite layer
    toggleGoogleSatellite() {
        if (this.layers.googleSatellite) {
            this.layers.googleSatellite.show = this.layerControls.googleSatellite;
        }
    }

    // Toggle OpenStreetMap Self layer
    toggleOpenStreetMapSelf() {
        if (this.layers.openStreetMapSelf) {
            this.layers.openStreetMapSelf.show = this.layerControls.openStreetMapSelf;
        }
    }

    // Toggle Province Boundaries layer
    async toggleProvinceBoundaries() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle District Boundaries layer
    async toggleDistrictBoundaries() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle SubDistrict Boundaries layer
    async toggleSubDistrictBoundaries() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Roads layer (Vector)
    async toggleRoads() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Railways layer (Vector)
    async toggleRailways() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Waterways layer (Vector)
    async toggleWaterways() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle POIs layer
    async togglePOIs() {
        // Trigger zoom-based loading through updateLayerVisibilityByZoom
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }

    // Toggle Buildings layer
    toggleBuildings() {
        this.updateLayerVisibilityByZoom(this.currentCameraHeight);
    }
}
