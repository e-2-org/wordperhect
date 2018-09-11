<?php
/**
 * class to manage all interaction with database, etc. for wordperhect
 * replacement processing script for saving and retrieving text for wordperhect.net
 * @author Peter Edwards <tech@e-2.org>
 * @version 1.1
 */

class wordPerhect {
	var $config;
	var $dbconn;
	public function __construct(&$config, &$dbconn)
	{
		$this->config =& $config;
		$this->dbconn =& $dbconn;
	}
	public function processRequest()
	{
		/* examine the request to see what needs to be done */
		if ($_SERVER["REQUEST_URI"] == "/tips.asp?action=rd") {
		    /* tips request */
			$this->getTips();
		} elseif (substr($_SERVER["REQUEST_URI"], -2) == "rd") {
		    /* read request */
		    $this->read();
	    } elseif (substr($_SERVER["REQUEST_URI"], -2) == "sg") {
		    /* save request */
	        $this->write();
        }
	}
	private function getTips()
	{
		/* read tips from tips.txt */
        $tipsfile = dirname(__FILE__) . "/tips.txt";
	    $lines = file($tipsfile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	    for ($i = 0; $i < count($lines); $i++) {
		    $tip = explode("|", $lines[$i]);
		    echo "&jname" . $i . "=" . urlencode(trim($tip[0]));
	    }
	    echo "&loaded=1";
	    exit;
	}
	private function getPaper()
	{
		$pap = 1;
		if (preg_match('/([0-9]+)/', $_SERVER["REQUEST_URI"], $matches)) {
			$doctmp = (int) $matches[1];
			if ($doctmp > 0 && $doctmp < 11) {
				$pap = $doctmp;
			}
		}
		return $pap;
	}
	private function read()
	{
		$query = sprintf("SELECT `savename`, `savetext`, `savedate` FROM `%s` WHERE  `pap` = %s LIMIT 0, %s", $this->config["dbtable"], $this->dbconn->qstr($this->getPaper()), $this->config["maxresults"]);
		$result = $this->dbconn->Execute($query);
		$count = 1;
        if (!$result) {
        	$this->log($conn->ErrorMsg());
        	exit;
        } else {
        	echo "&count=" . $result->RecordCount();
            while (!$result->EOF) {
                echo "&name" . $count . "=" . urlencode($result->fields[0]);
                echo "&m" . $count . "=" . urlencode($result->fields[1]);
                //echo "&date" . $count . "=" . urlencode(date("d F Y", $result->fields[2]));
                //echo "&IP" . $count . "=" . strlen($result->fields[1]);
                $count++;
                $result->MoveNext();
            }
            echo "&loaded=1";
            exit;
        }
	}
	private function write()
	{
        $name = trim($_POST["name"]);
        if ($name == "") {
        	$name = "untitled";
        }
        $msg = trim($_POST["m"]);
        if ($msg == "") {
        	echo "&m=&cconfirm=1";
        	exit;
        }
        $query = sprintf("INSERT INTO `%s` (`savedate`, `savetext`, `savename`, `pap`, `pen`, `pensize`, `papertype`, `location`) VALUES (UNIX_TIMESTAMP(), %s, %s", $this->config["dbtable"], $this->dbconn->qstr($msg), $this->dbconn->qstr($name));
        $paper = $this->getPaper();
        foreach ($this->config["saveInSession"] as $var) {
        	$dbvar = isset($_SESSION[$var])? $this->dbconn->qstr($_SESSION[$var]): "''";
        	if ($var == "pap") {
        		$dbvar = $this->dbconn->qstr($paper);
        	}
        	$query .= ", " . $dbvar;
        }
        $query .= ");";
        $this->dbconn->Execute($query);
        echo "&m=" . urlencode("Thank you - your message has been entered") . "&confirm=1";
        exit;
	}
	public function log($txt)
	{
		$logfile = dirname(__FILE__) . "/wp_log.txt";
		if ($fh = fopen($logfile, "ab")) {
			fwrite($fh, $txt);
			fclose($fh);
		}
	}
}
?>