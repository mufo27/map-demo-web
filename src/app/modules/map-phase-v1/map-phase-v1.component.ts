import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as Cesium from 'cesium';

@Component({
  selector: 'app-map-phase-v1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-phase-v1.component.html',
  styleUrl: './map-phase-v1.component.scss',
})
export class MapPhaseV1Component implements AfterViewInit, OnDestroy {
  viewer!: Cesium.Viewer;
  private geoserverUrl = 'http://192.168.88.217:6080/geoserver';
  private workspace = 'thailand-demo';

  // Layer references for toggling
  private layers = {
    openStreetMap: null as Cesium.ImageryLayer | null,
    googleSatellite: null as Cesium.ImageryLayer | null,
    provinceBoundaries: null as Cesium.ImageryLayer | null,
    districtBoundaries: null as Cesium.ImageryLayer | null,
    roads: null as Cesium.ImageryLayer | null,
    waterways: null as Cesium.ImageryLayer | null,
  };

  // Layer visibility states (bound to checkboxes)
  layerControls = {
    openStreetMap: false,
    googleSatellite: false,
    provinceBoundaries: false,
    districtBoundaries: false,
    roads: false,
    waterways: false,
  };

  // Panel collapse state
  panelCollapsed = false;

  // Search feature properties
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  private searchTimeout: any;

  // Toggle panel method
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
    });

    // เรียก methods ตาม Tier architecture
    this.setupTier0_Globe();
    this.setupTier1_Terrain();
    this.setupTier2_Imagery();
    this.setupTier3_VectorFeatures();

    // Zoom to Thailand
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100.5018, 13.7563, 2000000),
    });
  }

  // ============================================
  // TIER 0: Globe (Ellipsoid) - Base Layer
  // ============================================
  setupTier0_Globe() {
    // Cesium ใช้ Ellipsoid โดย default
    console.log('✓ Tier 0: Globe (Ellipsoid) initialized');
  }

  // ============================================
  // TIER 1: Terrain (DEM - ความสูง)
  // ============================================
  setupTier1_Terrain() {
    // ใช้ Ellipsoid Terrain (ไม่มีความสูง) สำหรับ Phase 1
    // Phase 2 จะเปลี่ยนเป็น DEM จริง
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    console.log('✓ Tier 1: Terrain (Ellipsoid) initialized');
  }

  // ============================================
  // TIER 2: Imagery (Orthophoto, แผนที่)
  // ============================================
  setupTier2_Imagery() {
    // ใช้ Cesium default base map (Bing Maps)
    console.log('✓ Tier 2: Using Cesium default base map (Bing Maps)');

    // 1. Optional: OpenStreetMap
    try {
      const provider = new Cesium.OpenStreetMapImageryProvider({
        url: 'https://a.tile.openstreetmap.org/',
      });
      this.layers.openStreetMap =
        this.viewer.imageryLayers.addImageryProvider(provider);
      this.layers.openStreetMap.show = this.layerControls.openStreetMap;
      console.log('✓ Tier 2: OpenStreetMap loaded (optional)');
    } catch (error) {
      console.error('✗ Error loading OSM:', error);
    }

    // 2. Optional: Google Maps Satellite
    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        credit: 'Google Maps Satellite',
      });
      this.layers.googleSatellite =
        this.viewer.imageryLayers.addImageryProvider(provider);
      // ซ่อนไว้ตามค่า checkbox (false)
      this.layers.googleSatellite.show = this.layerControls.googleSatellite;
      console.log('✓ Tier 2: Google Maps Satellite loaded');
    } catch (error) {
      console.error('✗ Error loading Google Maps:', error);
    }
  }

  // ============================================
  // TIER 3: Vector/Features (ถนน, ขอบเขต, POI)
  // ============================================
  setupTier3_VectorFeatures() {
    // สำหรับ Phase 1 ใช้ WMS (Imagery) ก่อน
    // Phase 2 จะเปลี่ยนเป็น WFS (Vector) เพื่อให้คลิกและ query ได้

    const wmsUrl = `${this.geoserverUrl}/wms`;

    // 1. ขอบเขตจังหวัด (Province Boundaries)
    this.layers.provinceBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:th_province`,
      'Province Boundaries'
    );

    // 2. ขอบเขตอำเภอ/ตำบล (District/Subdistrict Boundaries)
    this.layers.districtBoundaries = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:tha_admbndl_admALL_rtsd_itos_20220121`,
      'District/Subdistrict Boundaries'
    );

    // 3. ถนน (Roads)
    this.layers.roads = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_roads`,
      'Roads'
    );

    // 4. คลอง/ทางน้ำ (Waterways)
    this.layers.waterways = this.addWMSLayer(
      wmsUrl,
      `${this.workspace}:gis_osm_waterways`,
      'Waterways'
    );
  }

  // Helper method สำหรับเพิ่ม WMS Layer
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
      // ซ่อนไว้ทุก layer ให้เลือกจาก checkbox เท่านั้น
      layer.show = false;
      console.log(`✓ Tier 3: ${name} loaded (WMS)`);
      return layer;
    } catch (error) {
      console.error(`✗ Error loading ${name}:`, error);
      return null;
    }
  }

  // ============================================
  // Layer Toggle Methods (เรียกจาก checkbox)
  // ============================================
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

  // ============================================
  // Search Feature Methods
  // ============================================
  onSearchInput() {
    // Debounce search to avoid too many requests
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      this.showSearchResults = false;
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.performSearch();
    }, 300); // 300ms debounce
  }

  async performSearch() {
    if (!this.searchQuery.trim()) return;

    this.searchResults = [];
    this.showSearchResults = true;

    try {
      // Search from GeoServer WFS
      const results = await this.searchGeoServer(this.searchQuery);
      this.searchResults = results;
    } catch (error) {
      console.error('Search error:', error);
      this.searchResults = [];
    }
  }

  async searchGeoServer(query: string): Promise<any[]> {
    const results: any[] = [];

    try {
      // 1. Search Provinces (จังหวัด)
      const provinceResults = await this.searchLayer(
        `${this.workspace}:th_province`,
        query,
        'province',
        'PROV_NAMT',
        'PROV_NAME'
      );
      results.push(...provinceResults);

      // Search districts - Note: current schema doesn't have name fields
      // Layer exists but may need schema update to add ADM2_TH/ADM2_EN fields
      const districtResults = await this.searchLayer(
        `test-thailand:tha_admbndl_admALL_rtsd_itos_20220121`,
        query,
        'district',
        'ADM2_TH',
        'ADM2_EN'
      );
      results.push(...districtResults);

      // Search POI (Points of Interest)
      const poiResults = await this.searchLayer(
        `${this.workspace}:gis_osm_pois`,
        query,
        'poi',
        'name',
        'name'
      );
      results.push(...poiResults);
      // const poiResults = await this.searchLayer(
      //   `${this.workspace}:poi_layer`,
      //   query,
      //   'poi',
      //   'NAME_TH',
      //   'NAME_EN'
      // );
      // results.push(...poiResults);
    } catch (error) {
      console.error('GeoServer search error:', error);
    }

    return results.slice(0, 10); // Limit to 10 results
  }

  async searchLayer(
    layerName: string,
    query: string,
    type: string,
    thField: string,
    enField: string
  ): Promise<any[]> {
    try {
      const wfsUrl = `${this.geoserverUrl}/wfs`;

      // Build CQL_FILTER for Thai and English search
      const filter = `${thField} LIKE '%${query}%' OR ${enField} LIKE '%${query}%'`;

      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layerName,
        outputFormat: 'application/json',
        CQL_FILTER: filter,
        maxFeatures: '5',
        srsName: 'EPSG:4326', // Request coordinates in WGS84 (lat/lon)
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

      // Parse and format results
      return data.features.map((feature: any) => {
        const props = feature.properties;
        const geometry = feature.geometry;

        console.log('📄 Feature properties:', props);

        // Calculate center point from geometry
        let longitude = 0;
        let latitude = 0;
        let height = 50000; // Default zoom height

        if (geometry.type === 'Point') {
          [longitude, latitude] = geometry.coordinates;
        } else if (geometry.type === 'Polygon') {
          // Calculate centroid of polygon
          const coords = geometry.coordinates[0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        } else if (geometry.type === 'MultiPolygon') {
          // Calculate centroid of first polygon
          const coords = geometry.coordinates[0][0];
          longitude =
            coords.reduce((sum: number, c: any) => sum + c[0], 0) /
            coords.length;
          latitude =
            coords.reduce((sum: number, c: any) => sum + c[1], 0) /
            coords.length;
          height = type === 'province' ? 200000 : 100000;
        }

        // Get name (prefer Thai, fallback to English)
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
      district: 'อำเภอ/ตำบล',
      poi: 'สถานที่',
    };
    return labels[type] || type;
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      province: '🗺️',
      district: '📍',
      poi: '🏢',
    };
    return icons[type] || '📌';
  }

  selectSearchResult(result: any) {
    // Fly to the selected location
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        result.longitude,
        result.latitude,
        result.height
      ),
      duration: 2,
    });

    // Hide search results
    this.showSearchResults = false;

    console.log('Flying to:', result.name, result);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.viewer?.destroy();
  }
}
