<!DOCTYPE html>
<html>
<head>
 <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
 <link rel="stylesheet" href="/css/mainPage.css" />
 <link rel="stylesheet" href="/css/slideout.css" />
 <!--jQuery-->
 <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js"></script> 
 <script src='https://api.tiles.mapbox.com/mapbox-gl-js/v0.36.0/mapbox-gl.js'></script>
 <link href='https://api.tiles.mapbox.com/mapbox-gl-js/v0.36.0/mapbox-gl.css' rel='stylesheet' />
 <script src='https://npmcdn.com/@turf/turf/turf.min.js'></script>
<script src="https://unpkg.com/terraformer@1.0.7"></script>
<script src="https://unpkg.com/terraformer-wkt-parser@1.1.2"></script>
 
 <script src="https://code.jquery.com/jquery-1.12.2.js"></script>
 <script src="http://code.jquery.com/ui/1.11.4/jquery-ui.js"></script>
 <link href="http://code.jquery.com/ui/1.11.4/themes/ui-lightness/jquery-ui.css" rel="stylesheet">
 <link href="https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.28.3/css/theme.bootstrap.min.css" rel="stylesheet">

 <script type="text/javascript" src="/js/regression.js"></script>
 <script type="text/javascript" src="/js/canvasjs.min.js"></script>

<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/jquery.tablesorter/2.28.3/js/jquery.tablesorter.min.js"></script>
 
 <script src="http://code.highcharts.com/stock/highstock.js"></script>
 <script src="http://code.highcharts.com/stock/modules/exporting.js"></script>
 <meta name="csrf-token" content="{{ csrf_token() }}" />
 <script type="text/javascript">
  $.ajaxSetup({
    headers: {
      'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
    }
  });
</script>

<script src="//rawgithub.com/phpepe/highcharts-regression/master/highcharts-regression.js"> </script>
<!--boostrap-->
<!-- Latest compiled and minified CSS -->
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css" integrity="sha384-1q8mTJOASx8j1Au+a5WDVnPi2lkFfwwEAa8hDDdjZlpLegxhjVME1fgjWPGmkzs7" crossorigin="anonymous">
<!-- Latest compiled and minified JavaScript -->
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js" integrity="sha384-0mSbJDEHialfmuBBQP6A4Qrprq5OVfW37PRR3j5ELqxss1yVqOtnepnHVP9aJ7xS" crossorigin="anonymous"></script>
</head>
<body>
  <div id="subset-swath-popup">
    <table class="table" id="subset-swath-table">
      <thead>
        <tr>
          <th>
            Start Date
          </th>
          <th>
            End Date
          </th>
          <th>
            Unavco Name
          </th>
        </tr>
      </thead>
      <tbody>
      </tbody>
    </table>
  </div>
  <div id="information-div" class="overlay-div">
    <div id="information-div-contents">
      <p>
        This website provides InSAR displacement time-series produced by the University of Miami Geodesy Laboratory,   which is supported by NASA and the NSF. To identify data sets from published papers please search for the author's names.
        </p>
      <p>
        This website was created by  University of Miami. Computer Science students Alfredo Terrero and Zishi Wu. It started as a class project of CSC 431, taught by  Chris Mader and Julio Perez of the University of Miami’s Center for Computational Sciences (CCS). The data processing is conducted using the University of Miami’s High Performance Computing systems.
      </p>
      @if (Auth::guest())
        <p>
          To identify data sets from published papers please search for the author's names. To access data sets which are not yet finalized, please login here:
        </p>
        <div id="login-logout-button">
          <button class="btn btn-primary-outline">Login</button>
        </div>
      @endif
      <p>
        For accessing the data products via web services click here:
      </p>
      <div id="webservices-ui-button">
        <button class="btn btn-primary-outline">Web Services</button>
      </div>
      <p>
        This website relies on Mapbox GL JS, which in turn relies on WebGL. As it stands, Google Chrome offers the best compatibility when browsing this site.
      </p>
      <img src="/img/nasa.png" alt="nasa_logo" height="100px" width="auto">
      <img src="/img/nsf1.gif" alt="nsf_logo" height="100px" width="auto" class="logo2">
      <div id="information-div-buttom-buttons">
        <div id="close-information-button">
          <button class="btn btn-primary-outline">Done</button>
        </div>
      </div>
    </div>
  </div>
  <div id="loading-screen" class="overlay-div">
    <div id="loading-screen-contents">
      <div class="loading-text-div" id="loading-text-div-top">
        Recoloring in progress...
      </div>
      <div id="loading-circle-container">
        <div class="loading-circle"></div>
      </div>
      <div class="loading-text-div" id="loading-text-div-bottom">ESCAPE to interrupt</div>
    </div>
  </div>
  <div id="map-container">
    <div id="top-map-buttons">
      <div id="search-form">
        <!--search bar-->
        <div id="search-bar">
          <div class="input-group custom-input">
            <!-- <span class="input-group-btn">
              <button class="btn btn-default" id="search-button" type="button">Search</button>
            </span> -->
            <input type="text" placeholder="Search for..." id="search-input"/>
            <div class="custom-input-dropdown" id="toggle-other-bars">
              <div class="caret"></div>
            </div>
          </div>
        </div>
        <div id="hidden-search-bars-container">
          <div class="form-group custom-input">
            <input type="text" placeholder="Satellite" id="input-satellite" list="satellites-list"/>
            <div class="custom-input-dropdown hide-dropdown">
              <div class="caret"></div>
            </div>
          </div>
          <div class="form-group custom-input">
            <input type="text" placeholder="Relative Orbit" id="input-relative-orbit"/>
          </div>
          <div class="form-group custom-input">
            <input type="text" placeholder="First Frame" id="input-first-frame"/>
          </div>
          <div class="form-group custom-input">
            <input type="text" placeholder="Mode" id="input-mode" list="modes-list"/>
            <div class="custom-input-dropdown hide-dropdown">
              <div class="caret"></div>
            </div>
            <!-- <datalist id="modes-list"></datalist> -->
          </div>
          <div class="form-group custom-input">
            <input type="text" placeholder="Flight Direction" id="input-flight-direction" list="flight-direction-list"/>
            <div class="custom-input-dropdown hide-dropdown">
              <div class="caret"></div>
            </div>
          </div>
          <div class="form-group custom-input">
            <div class="overlay-toggle">
              <label>Last year data</label>
              <input id = "recent-datasets-toggle-button" type="checkbox"/>
            </div>
          </div>
          <!-- enter button to search for files with attributes matching above input -->
          <!-- <div id="enter-button-search-attributes">
            <button class="btn btn-primary btn-block">Enter</button>
          </div> -->
        </div>
      </div>
      <div id="overlay-options-wrapper">
        <div id="overlay-options">
          Opacity:
          <div id="overlay-slider"></div>
        </div>
      </div>
      <div id="reset-button">
        <button class="btn btn-primary-outline">Reset</button>
      </div>
      <div id="information-button">                
        <button class="btn btn-primary-outline">About</button>
      </div>
      @if (Auth::check()) 
      <div class="logged-in" id="login-logout-button">
       <button class="btn btn-primary-outline">Logout</button>
     </div>
     @endif
     <div id="polygon-button-div">
      <button class="btn btn-primary-outline map-button no-padding clickable-button" data-toggle="tooltip" data-placement="right" title="Select Points" id="polygon-button">
        <img src="/img/polygon.svg" alt="polygon.svg">
      </button>
    </div>
    <div>
      <button class="btn btn-primary-outline map-button no-padding" data-toggle="tooltip" data-placement="right" title="Hide Swaths" id="dataset-frames-toggle-button">
          <img src="/img/swathIcon.png" alt="swathIcon.png" style="width: 20px; height: 20px">
      </button>
    </div>
    <div id="select-layer-button-div">
      <button class="btn btn-primary-outline map-button" data-toggle="tooltip" data-placement="right" title="More Options" id="select-layer-button">
        <img src="/img/layerSwitchIcon.png" alt="layerSwitchIcon.png" style="width: 20px; height: 20px">
      </button>
      <div id="overlay-options-toggles">
        <div id="map-type-menu">
          <input id='streets' type='radio' name='rtoggle' value='streets' checked="checked"/>
          <label for='streets'>Streets</label>
          <input id='satellite' type='radio' name='rtoggle' value='satellite'/>
          <label for='satellite'>Satellite</label>
        </div>
        <div>
          <label>Color On:</label>
          <select id="color-on-dropdown">
            <option value="velocity">Velocity</option>
            <option value="displacement">Displacement</option>
          </select>
        </div>
        <div>
          <label>Color Seismicity On:</label>
          <select id="seismicity-color-on-dropdown">
            <option value="depth">Depth</option>
            <option value="time">Time</option>
          </select>
        </div>
      </div>
    </div>
  </div>
  <!-- by default, it is toggled, or minimized -->
  <div id="search-form-and-results-container" class="minimized">
    <div id="search-form-results">
      <section class="fixed-header-table">
        <div class="fixed-header-table-container">
          <table class="tablesorter-bootstrap" id="search-form-results-table">
            <thead>
              <tr class="header">
                <th>
                  Satellite
                  <div>Satellite</div>
                </th>
                <th>
                  Rel Orbit
                  <div>Rel Orbit</div>
                </th>
                <th>
                  First_Frame
                  <div>First Frame</div>
                </th>
                <th>
                  Mode
                  <div>Mode</div>
                </th>
                <th>
                  Flight Dir.
                  <div>Flight Dir.</div>
                </th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
      </section>
      <div class="top-right-buttons">
        <button type="button" class="minimize-button" data-dismiss="modal" aria-label="Close" id="search-form-and-results-minimize-button"></button>
      </div>
    </div>
  </div>
  <div id="color-scale">
    <div class="color-scale-text-div" class="rotate">
      LOS Velocity [cm/yr]
    </div>
    <div class="color-scale-main-container">
      <div class="color-scale-and-values-container" class="clearfix">
        <div class="color-scale-picture-div">
          <img src="/img/jet_scale.PNG" alt="jet_scale.PNG">
        </div>
        <div class="scale-values">
          <div class="left-scale-minimum">
            <div class="form-group">
              <input type="number" class="form-control bottom-scale-value"/>
            </div>
          </div>
          <div class="right-scale-maximum">
            <div class="form-group">
              <input type="number" class="form-control top-scale-value"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div id="point-details"></div>
  <div class="maximize-buttons-container">
    <div class="btn btn-primary">
      <div class="maximize-button-container">
          <button type="button" class="maximize-button" data-dismiss="modal" id="seismicity-charts-maximize-button" data-toggle="tooltip" title="Seismicity Plots"></button>
      </div>
      <div class="maximize-button-container">
          <button type="button" class="maximize-button" data-dismiss="modal" id="seismicity-chart-sliders-maximize-button" data-toggle="tooltip" title="Seismicity Plot Sliders"></button>
      </div>
    </div>
    <div class="btn btn-primary">
      <div class="maximize-button-container">
        <button type="button" class="maximize-button" data-dismiss="modal" aria-label="Close" id="search-form-and-results-maximize-button" data-toggle="tooltip" title="Datasets"></button>
      </div>
      <div class="maximize-button-container">
        <button type="button" class="maximize-button" data-dismiss="modal" aria-label="Close" data-toggle="tooltip" title="Displacement Timeseries" id="graph-div-maximize-button"></button>
      </div>
      <div class="maximize-button-container">
        <button type="button" class="maximize-button" data-dismiss="modal" aria-label="Close" data-toggle="tooltip" title="Attributes" id="area-attributes-div-maximize-button"></button>
      </div>
    </div>
  </div>
  <div class="wrap minimized" id="charts" title="Displacement time-series">
    <div class="top-right-buttons">
      <button type="button" class="minimize-button" data-dismiss="modal" aria-label="Close" id="graph-div-minimize-button"></button>
    </div>
    <div class="content">
      <div class="chart-containers" id="chart-containers">
        <div id="chartContainer" class="side-item">
        </div>
        <div id="chartContainer2" class="side-item"></div>
      </div>
      <div id="graph-select-div">
        <div class="overlay_toggle">
          <div id="top-graph-focus-div">
            Select
            <input id = "top-graph-toggle-button" type="checkbox" name="overlayToggle"/>
          </div>
        </div>
        <div class="overlay_toggle">
          <div id="bottom-graph-focus-div">
            Select
            <input id = "bottom-graph-toggle-button" type="checkbox" name="overlayToggle"/>
          </div>
        </div>
      </div>
      <div id="map-options">
        <div class="overlay_toggle">
          <label>Second graph</label>
          <input id = "second-graph-toggle-button" type="checkbox" name="overlayToggle"/>          
        </div>
        <div class="overlay_toggle">
          <label>Line</label>
          <input id = "dot-toggle-button" type="checkbox" name="overlayToggle"/>          
        </div>
        <div class="overlay_toggle">
          <label>Regression</label>
          <input id = "regression-toggle-button" type="checkbox" name="overlayToggle"/>          
        </div>
        <div class="overlay_toggle">
          <label>Detrend</label>
          <input id = "detrend-toggle-button" type="checkbox" name="overlayToggle"/>          
        </div>
        <div id="download-as-text-button">
          <button class="btn btn-primary-outline">Download as TXT</button>
        </div>
      </div>
    </div> 
  </div>
  <!--<div class="wrap" id="seismicity-charts">
    <div class="top-right-buttons">
      <button type="button" class="minimize-button" data-dismiss="modal" id="seismicity-charts-minimize-button"></button>
    </div>
    <div class="content">
      <div class="chart-containers" id="seismicity-charts-container">
        <div class="seismicity-chart">
          <div class="side-by-side" id="lat-vs-long-graph"></div>
          <div class="side-by-side" id="lat-vs-depth-graph"></div>
        </div>
        <div class="seismicity-chart">
          <div class="side-by-side" id="depth-vs-long-graph"></div>
          <div class="side-by-side">
            <div class="minimap-color-scale" id="lat-vs-long-depth-color-scale">
              <div class="color-scale-text-div" class="rotate">
                Depth (Km)
              </div>
              <div class="color-scale-main-container">
                <div class="color-scale-and-values-container clearfix">
                  <div class="color-scale-picture-div">
                    <img src="/img/jet_scale.PNG" alt="jet_scale.PNG">
                  </div>
                  <div class="scale-values">
                    <div class="left-scale-minimum">
                      <div class="form-group">
                        <input type="number" class="form-control bottom-scale-value"/>
                      </div>
                    </div>
                    <div class="right-scale-maximum">
                      <div class="form-group">
                        <input type="number" class="form-control top-scale-value"/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="minimap-color-scale" id="lat-vs-long-time-color-scale">
              <div class="color-scale-text-div" class="rotate">
                Time
                <div>
                  <label>Color On:</label>
                  <select id="minimap-color-on-dropdown">
                    <option value="depth">Depth</option>
                    <option value="time">Time</option>
                  </select>
                </div>
              </div>
              <div class="color-scale-main-container">
                <div class="color-scale-and-values-container clearfix">
                  <div class="color-scale-picture-div">
                    <img src="/img/jet_scale.PNG" alt="jet_scale.PNG">
                  </div>
                  <div class="scale-values">
                    <div class="left-scale-minimum">
                      <div class="form-group">
                        <input type="number" class="form-control bottom-scale-value"/>
                      </div>
                    </div>
                    <div class="right-scale-maximum">
                      <div class="form-group">
                        <input type="number" class="form-control top-scale-value"/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="seismicity-chart"><div id="cumulative-events-vs-date-graph""></div></div>
      </div>
    </div>
  </div>
  <div class="wrap" id="seismicity-chart-sliders">
    <div class="top-right-buttons">
      <button type="button" class="minimize-button" data-dismiss="modal" id="seismicity-chart-sliders-minimize-button"></button>
    </div>
    <div class="content">
      <div class="chart-containers">
        <h7>Depth (Distribution)</h7>
        <div class="seismicity-chart-slider" id="depth-slider"></div>
        <h7>Time (Cumulative)</h7>
        <div class="seismicity-chart-slider" id="time-slider"></div>
        <button class="btn btn-primary-outline slider-range-button" id="set-slider-ranges-button">Set New Range</button>
        <button class="btn btn-primary-outline slider-range-button" id="reset-slider-ranges-button">Reset Default Range</button>
      </div>
    </div>
  </div>
  </div>
  <div class="wrap minimized" id="area-attributes-div" title="Attributes">
   <div class="top-right-buttons">
      <button type="button" class="minimize-button" data-dismiss="modal" aria-label="Close" id="area-attributes-div-minimize-button"></button>
    </div>
    <div class="content">
        <ul class="tab">
          <div id="area-attributes-areaname-div"></div>
          <li><a href="#" id="details-tab-link" class="tablinks" onclick="goToTab(event, 'details-tab')">Details</a></li>
          <li><a href="#" class="tablinks" onclick="goToTab(event, 'downloads-tab')">Downloads</a></li>
          <li><a href="#" class="tablinks" onclick="goToTab(event, 'reference-tab')">Reference</a></li>
          <li><a href="#" class="tablinks" onclick="goToTab(event, 'figures-tab')">Figures</a></li>
          <!-- <li><a href="#" class="tablinks" onclick="goToTab(event, 'links-tab')">Links</a></li> -->
        </ul>
        <div id="details-tab" class="tabcontent">
          <table class="table" id="area-attributes-table">
            <thead>
            </thead>
            <tbody id="area-attributes-table-body">
            </tbody>
          </table>
        </div>

        <div id="downloads-tab" class="tabcontent">
          <p>Download to Unavco InSAR data products to be implemented.</p>
        </div>

        <div id="reference-tab" class="tabcontent">
          <p>Reference to the papers to be added.</p>
        </div>

        <div id="figures-tab" class="tabcontent">
          <p>Figures to be added.</p>
        </div>
        <!-- <div id="links-tab" class="tabcontent">
          <p>Extra links to be added.</p>
        </div> -->
      </div>
    </div>
  </div>
  <div class="wrap" id="topography-wrap" title="Topography-Wrap">
    <div class="top-right-buttons">
      <button type="button" class="close close-button" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
    </div>
    <div class="content"></div>
  </div>
    <script type="text/javascript">
      var urlOptions = {!! json_encode($urlOptions) !!};
    </script>
    <script type="text/javascript" src="/js/fuse.js"></script>
    <script type="text/javascript" src="/js/GraphsController.js"></script>
    <script type="text/javascript" src="/js/CancellableAjax.js"></script>
    <script type="text/javascript" src="/js/gpsStations.js"></script>
    <script type="text/javascript" src="/js/ColorScale.js"></script>
    <script type="text/javascript" src="/js/AreaMarkerLayer.js"></script>
    <script type="text/javascript" src="/js/AreaAttributesController.js"></script>
    <script type="text/javascript" src="/js/mainPage.js"></script>
    <script type="text/javascript" src="/js/SearchFile.js"></script>
    <script type="text/javascript" src="/js/Swath.js"></script>
    <script type="text/javascript" src="/js/Vector.js"></script>
    <script type="text/javascript" src="/js/ThirdPartySourcesController.js"></script>
    <script type="text/javascript" src="/js/mainMap.js"></script>
    <script type="text/javascript" src="/js/SquareSelector.js"></script>
    <script type="text/javascript" src="/js/LineSelector.js"></script>
    <script type="text/javascript" src="/js/FeatureSelector.js"></script>
    <script type="text/javascript" src="/js/AreaFilterSelector.js"></script>
    <script type="text/javascript" src="/js/GoogleElevationChunkedQuerier.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBm77jFIq1iM3mpL5CgB1uvW6jGcefbIYs"
    async defer></script>
  </body>
  </html>
