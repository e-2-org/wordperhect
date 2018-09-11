<!--#include file="flash4lib.asp"-->
<% 
Response.Expires = 0

' Populating variables from the HTTP Header and the Server
action = Request("action")
delimiter = "|"

'rd is the read data function called when the flash movie loads
if action = "rd" Then
	RD()
elseif action = "sg" Then
    SG()
else
m = "No query string entered"
response.write ("&m=" +URLEncode(m)+"&cconfirm=1")
response.end
End If

Function RD()
Const ForReading = 1, ForWriting = 2, ForAppending = 3
Dim objFSO, objCountFile  ' object vars for FSO and File
Dim strCountFileName      ' filename of count text file
Dim majortscore

strCountFileName=server.mappath("text/10.txt")
Set objFSO = CreateObject("Scripting.FileSystemObject")
        Set objCountFile = objFSO.OpenTextFile(strCountFileName, 1, True)
        If Not objCountFile.AtEndOfStream Then
	    '    Set value to contents of the file
        majortscore = split(objCountFile.readall, vbCrlf, -1)
	    'majortscore = CSng(objCountFile.ReadAll)
        Else
	    ' If no file exists or it's empty start at 0
	    majortscore = 0
        End If
        objCountFile.Close
        Set objCountFile = Nothing
        Set objFSO = Nothing
        
        if isarray(majortscore) then
		last = ubound(majortscore) - 1
		i = lbound(majortscore) + 1
        response.write ("&count="&last)
		for i=i to last
		singlemail = split(majortscore(i), delimiter)


 response.write ("&name" & (i) & "=" +URLEncode(singlemail(0)))
  'response.write ("&email" & (i) & "=" +URLEncode(singlemail(1)))
   response.write ("&m"& (i) & "=" +URLEncode(singlemail(2)))
    'response.write ("&url"& (i) & "=" +URLEncode(singlemail(3)))
     response.write ("&date" & (i) & "=" +URLEncode(singlemail(4)))
      response.write ("&IP" & (i) & "=" +URLEncode(singlemail(5)))
		next
	end if
'response.write majortscore
response.write ("&loaded=1")
End Function


Function SG()

'IP = Request.ServerVariables("REMOTE_ADDR")
name = Request.form("name")
m = Request.form("m")

if name = "" Then
    name= "untitled"
End If

if m = "" Then
m = "&m=" +URLEncode(m)+"&cconfirm=1"	'"hey! you have to write something first...."
response.write ("&m=" +URLEncode(m)+"&cconfirm=1")
    Exit Function
End If

Const ForReading = 1, ForWriting = 2, ForAppending = 3
Dim objFSO, objCountFile  ' object vars for FSO and File
Dim strCountFileName      ' filename of count text file
Dim majortscore
strCountFileName=server.mappath("text/10.txt")
        Set objFSO = CreateObject("Scripting.FileSystemObject")
        Set objCountFile = objFSO.OpenTextFile(strCountFileName, 1, True)
        objCountFile.Close

    
	if not isarray(maillist) then
			Set objCountFile = objFSO.OpenTextFile(strCountFileName, 8, true)
			objCountFile.write name & delimiter & email & delimiter & m & delimiter & url & delimiter & formatdatetime(date(), 1) & delimiter & IP & vbCrlf
			objCountFile.close
	else
		Application.Lock
		Set objCountFile = objFSO.OpenTextFile(strCountFileName, ForWriting, true)
		last = Ubound(maillist)
		i = Lbound(maillist)
		for	i = i to last
			singlemail = split(maillist(i), delimiter)
		next
			objCountFile.write name & delimiter & email & delimiter & m & delimiter & url & delimiter & formatdatetime(date(), 1) & delimiter & IP & vbCrlf
		objCountFile.close		
		Application.UnLock
	end if
        Set objCountFile = Nothing
        Set objFSO = Nothing
'm = "Thank you - your message has been entered"
response.write ("&m=" +URLEncode(m)+"&confirm=1")
response.end
End Function

%>