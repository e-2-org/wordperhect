<% 
$response->{Expires} = 0;
$tipsFile = '/var/www/vhosts/wordperhect.net/httpdocs/tips.txt';
if ($Request->QueryString('action') eq 'rd') {
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
    $Response->write('&message=' . $Server->URLEncode('No query string entered') . '&cconfirm=1');
}
%>