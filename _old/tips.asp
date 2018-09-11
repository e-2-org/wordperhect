<% 
$response->{Expires} = 0;
$tipsFile = '/var/www/vhosts/wordperhect.net/httpdocs/tips.txt';
$action = $Request->QueryString('action');

if ($action eq 'rd') {
		
    open(FH, $tipsFile);
		@data = <FH>;
		close(FH);
		for (my $i = 0; $i < @data; $i++) {
				@fields = split('/\|/', $data[$i]);
				chomp(@fields);
        $Response->write("&jname" . $i . "=" . $Server->URLEncode($fields[0]));
    }
		$Response->Write('&loaded=1');
}
else {
    $message = 'No query string entered';
    $Response->write('&message=' . $Server->URLEncode($message) . '&cconfirm=1');
}
%>