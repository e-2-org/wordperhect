<?php
/**
 * bootstrapping for perhect
 */

/* include configuration */
require_once(dirname(__FILE__) . "/config.php");
/* include adodb */
require_once($config["adodb_dir"] . "/adodb.inc.php");
/* set up a database connection */
$dsn = $config["dbtype"] . "://" . $config["dbuser"] . ":" . $config["dbpass"] . "@" . $config["dbhost"] . "/" . $config["dbname"];
$dbconn = ADONewConnection($dsn);
/* include session support from adodb */
require_once($config["adodb_dir"] . "/session/adodb-session2.php");
/* start session management */
ADOdb_Session::config($config["dbtype"], $config["dbhost"], $config["dbuser"], $config["dbpass"], $config["dbname"]);
session_start();
/* save some data in the session as this isn't passed to the save function */
foreach ($config["saveInSession"] as $var) {
    if (isset($_POST[$var])) {
    	$_SESSION[$var] = $_POST[$var];
    }
}
/* include the perhect class */
require_once(dirname(__FILE__) . "/wordPerhect.php");
/* instantiate a wordPerhect obect */
$wp = new wordPerhect($config, $dbconn);
?>