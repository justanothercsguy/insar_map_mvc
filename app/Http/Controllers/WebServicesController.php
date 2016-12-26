<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use DateTime;

use App\Http\Requests;
use DB;

// pChart library
use CpChart\Factory\Factory;
use Exception;

// TODO: make all these date functions into own class - it's weird that they are here. also format graph to look better.

class WebServicesController extends Controller
{
    public function __construct() {
      $this->arrayFormatter = new PostgresArrayFormatter();
    }

    // assume input dateString is in format mm/dd/yyyy, ex: 12/19/2010
    // return decimal version of dateString, ex: 2007.9671232877
    public function dateToDecimal($dateString) {
      $parsedDate = explode("/", $dateString);

      // php dateTime object requires format yyyy-mm-dd
      $date = new DateTime();
      $date->setDate($parsedDate[2], $parsedDate[0], $parsedDate[1]);

      return $date->format("Y") + ($this->getDaysElapsed($date)) / 365.0;
    }

    // assume input date is in format of a PHP dateTime object with year Y,
    // return days elapsed from beginning of year Y up to input date
    public function getDaysElapsed($date) {
      $date2 = new DateTime();
      $date2->setDate($date->format("Y"), 1, 1);
      $interval = date_diff($date, $date2);

      return $interval->format("%a");
    }

    private function dateStringToUnixTimestamp($dateString) {
      $parsedDate = explode("/", $dateString);

      // php dateTime object requires format yyyy-mm-dd
      $date = new DateTime();
      $date->setDate($parsedDate[0], $parsedDate[1], $parsedDate[2]);
      
      return $date->getTimestamp();
    }

    private function stringDatesArrayToUnixTimeStampArray($stringDates) {
      $len = count($stringDates);
      $unixTimeStamps = [];

      for ($i = 0; $i < $len; $i++) {
        $year = substr($stringDates[$i], 0, 4);
        $month = substr($stringDates[$i], 4, 2);
        $day = substr($stringDates[$i], 6, 2);
        $dateString = $year . "/" . $month . "/" . $day;

        array_push($unixTimeStamps, $this->dateStringToUnixTimestamp($dateString));
      }

      return $unixTimeStamps;
    }

    private function getDisplacementChartDate($displacements, $stringDates) {
      $data = [];
      $len = count($stringDates);
      $unixDates = $this->stringDatesArrayToUnixTimeStampArray($stringDates);

      for ($i = 0; $i < $len; $i++) {
        // high charts wants milliseconds so multiply by 1000
        array_push($data, [$unixDates[$i] * 1000, $displacements[$i]]);
      }

      return $data;
    }

    private function generatePlotPicture($displacements, $stringDates) {
      $jsonString = '{
        "title": {
          "text": null
        },
          "subtitle": {
            "text": "velocity: "
          },
          "navigator": {
            "enabled": true
          },
          "scrollbar": {
            "liveRedraw": false
          },
          "xAxis": {
            "type": "datetime",
            "dateTimeLabelFormats": {
              "month": "%e. %b",
              "year": "%Y"
            },
            "title": {
              "text": "Date"
            }
          },
          "yAxis": {
            "title": {
              "text": "Ground Displacement (cm)"
            },
            "legend": {
              "layout": "vertical",
              "align": "left",
              "verticalAlign": "top",
              "x": 100,
              "y": 70,
              "floating": true,
              "backgroundColor": "#FFFFFF",
              "borderWidth": 1
            },
            "plotLines": [{
              "value": 0,
              "width": 1,
              "color": "#808080"
            }]
          },
          "tooltip": {
            "headerFormat": "",
            "pointFormat": "{point.x:%e. %b %Y}: {point.y:.6f} cm"
          },
          "series": [{
            "type": "scatter",
            "name": "Displacement",
            "data": [],
            "marker": {
              "enabled": true
            },
            "showInLegend": false
          }],
          "chart": {
            "marginRight": 50
          }
      }';

      // pass true to get associative array instead of std class object
      $json = json_decode($jsonString, true);
      // debugging, remove when chart fully working
      switch (json_last_error()) {
        case JSON_ERROR_NONE:
          break;
        case JSON_ERROR_DEPTH:
          echo ' - Maximum stack depth exceeded';
          break;
        case JSON_ERROR_STATE_MISMATCH:
          echo ' - Underflow or the modes mismatch';
          break;
        case JSON_ERROR_CTRL_CHAR:
          echo ' - Unexpected control character found';
          break;
        case JSON_ERROR_SYNTAX:
          echo ' - Syntax error, malformed JSON';
          break;
        case JSON_ERROR_UTF8:
          echo ' - Malformed UTF-8 characters, possibly incorrectly encoded';
          break;
        default:
          echo ' - Unknown error';
          break;
      }

      $json["series"][0]["data"] = $this->getDisplacementChartDate($displacements, $stringDates);

      $jsonString = json_encode(($json));

      $tempPictName = tempnam(storage_path(), "pict");
      $command = "highcharts-export-server --instr '" . $jsonString . "' --outfile " . $tempPictName . " --type jpg";

      exec($command);
      $headers = ["Content-Type" => "image/jpg", "Content-Length" => filesize($tempPictName)];
      $response = response()->file($tempPictName, $headers)->deleteFileAfterSend(true);
      // header("Content-Type: image/jpg");
      // header("Content-Length: " . filesize($tempPictName));
      // fpassthru($pictFile);
      // delete file to not clutter server
      return $response;
    }

    // given a decimal format min and max date range, return indices of dates 
    // that best correspond to min and max from an array of valid decimal dates 
    public function getDateIndices($minDate, $maxDate, $arrayOfDates) {
      $minIndex = 0;
      $maxIndex = 0;
      $currentDate = 0; 
      $minAndMaxDateIndices = []; 
   
      for ($i = 0; $i < count($arrayOfDates); $i++) {
        $currentDate = $arrayOfDates[$i];
        if ($currentDate >= $minDate) {
          $minIndex = $i;
          break;
        }
      }

      for ($i = 0; $i < count($arrayOfDates); $i++) {
        $currentDate = $arrayOfDates[$i];
        if ($currentDate < $maxDate) {
          $maxIndex = $i + 1;
        }
      }

      array_push($minAndMaxDateIndices, $minIndex);
      array_push($minAndMaxDateIndices, $maxIndex);

      return $minAndMaxDateIndices;
    }  


    // given a dataset name and point, returns json array containing
    // decimaldates, stringdates, and displacement values of that point
    public function createJsonArray($dataset, $point, $minDate, $maxDate) {
      $json = [];
      $decimal_dates = null;
      $string_dates = null;
      $displacements = $point->d;

      $minDateIndex = -1;
      $maxDateIndex = -1;
      $minAndMaxDateIndices = null;

      $query = "SELECT decimaldates, stringdates FROM area WHERE unavco_name like ?";
      $dateInfos = DB::select($query, [$dataset]);

      foreach ($dateInfos as $dateInfo) {
        $decimal_dates = $dateInfo->decimaldates;
        $string_dates = $dateInfo->stringdates;
      }

      // convert SQL data from string to array format
      $decimal_dates = $this->arrayFormatter->postgresToPHPFloatArray($decimal_dates);
      $string_dates = $this->arrayFormatter->postgresToPHPFloatArray($string_dates);
      $displacements = $this->arrayFormatter->postgresToPHPFloatArray($displacements);

      // * Select dates that best match minDate and maxDate - if not specified, minDate is first date
      // and maxDate is last date in decimaldates and stringdates
      // * Currently we are not accounting for condition where user specifies a minDate but no maxDate,
      // or a maxDate but no minDate
      // * Currently we are not accounting for condition where user types incorrect date - in future need
      // to get a isValidDate checker
      if ($minDate != -1 && $maxDate != -1) {
        // convert minDate and maxDate into decimal dates
        $minDate = $this->dateToDecimal($minDate);
        $maxDate = $this->dateToDecimal($maxDate);
        $minAndMaxDateIndices = $this->getDateIndices($minDate, $maxDate, $decimal_dates);
        $minDateIndex = $minAndMaxDateIndices[0];
        $maxDateIndex = $minAndMaxDateIndices[1];
      } 
      else {  // otherwise we set minDate and maxDate to default date array in specified dataset
        $minDateIndex = 0;
        $maxDateIndex = count($decimal_dates);
      }

      // put dates and displacement into json, limited by range 
      // minDateIndex to (maxDateIndex - minDateIndex + 1)
      $json["decimal_dates"] = array_slice($decimal_dates, $minDateIndex, ($maxDateIndex - $minDateIndex + 1));
      $json["string_dates"] = array_slice($string_dates, $minDateIndex, ($maxDateIndex - $minDateIndex + 1));
      $json["displacements"] = array_slice($displacements, $minDateIndex, ($maxDateIndex - $minDateIndex + 1));

      return $json;
    }


    // main entry point into web services
    // given a latitude, longitude, and dataset - return json array for stringdates, decimaldates,
    // and displacements of point that corresponds to input data or return null if data is invalid
    // user also has option of sending a minDate and maxDate to specify the range of dates they would
    // like to view data from - this range is by default set to the first and last date of the dataset
    public function processRequest(Request $request) {
      $json = [];
      $requests = $request->all();
      $len = count($requests);

      // we need latitude, longitude, dataset
      // optional request vaues are minDate and maxDate
      // set lat and long to 1000.0 (impossible value) and dataset to empty string
      // if these initial values are retained then we did not get enough info to query
      $latitude = 1000.0;
      $longitude = 1000.0;
      $dataset = "";
      $minDate = -1;
      $maxDate = -1;

      foreach ($requests as $key => $value) {
        if ($key == "latitude") {
          $latitude = $value ;
        }
        else if ($key == "longitude") {
          $longitude = $value ;
        }
        else if ($key == "dataset") {
          $dataset = $value;
        }
        else if ($key == "minDate") {
          $minDate = $value;
        }
        else if ($key == "maxDate") {
          $maxDate = $value;
        }
      }

      if ($latitude == 1000.0 || $longitude == 1000.0 || strlen($dataset) == 0) {
        echo "Error: Incomplete/Invalid Data for Retrieving a Point";
        return NULL;
      }

      // perform query
      $delta = 0.0005;  // range of error for latitude and longitude values, can be changed as needed
      $p1_lat = $latitude - $delta;
      $p1_long = $longitude - $delta;
      $p2_lat = $latitude + $delta;
      $p2_long = $longitude - $delta;
      $p3_lat = $latitude + $delta;
      $p3_long = $longitude + $delta;
      $p4_lat = $latitude - $delta;
      $p4_long = $longitude + $delta;
      $p5_lat = $latitude - $delta;
      $p5_long = $longitude - $delta;
      $query = " SELECT p, d, ST_X(wkb_geometry), ST_Y(wkb_geometry) FROM " . $dataset . "
            WHERE st_contains(ST_MakePolygon(ST_GeomFromText('LINESTRING( " . $p1_long . " " . $p1_lat . ", " . $p2_long . " " . $p2_lat . ", " . $p3_long . " " . $p3_lat . ", " . $p4_long . " " . $p4_lat . ", " . $p5_long . " " . $p5_lat . ")', 4326)), wkb_geometry);";

      $points = DB::select(DB::raw($query));

      // * Currently we hardcode by picking the first point in the $points array
      // in future we will come up with algorithm to get the closest point
      $json = $this->createJsonArray($dataset, $points[0], $minDate, $maxDate);
      return $this->generatePlotPicture($json["displacements"], $json["string_dates"]);

      //return json_encode($json);*/
    }
}