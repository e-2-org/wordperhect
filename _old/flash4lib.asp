<%
' Encode a number from 0..15 to a single hex digit
Function HexChar(ByVal i)
	If i < 10 Then
		HexChar = Chr(i+Asc("0"))
	Else
		HexChar = Chr(i-10+Asc("A"))
	End If
End Function

' Encode the control and punctuation characters in a string to %xx hex values
Function URLEncode(ByVal s)
	Dim result, ch
	Do While Len(s) > 0
		ch = Asc(s)
		s = Right(s, Len(s)-1)
		If (ch >= Asc("a") And ch <= Asc("z")) Or (ch >= Asc("A") And ch <= Asc("Z")) Or (ch >= Asc("0") And ch <= Asc("9")) Then
			result = result & Chr(ch)
		ElseIf ch = Asc(" ") Then
			result = result & "+"
		Else
			'result = result & "*" & ch
			'result = result & "!" & (ch/16) & (ch mod 16)
			result = result & "%" & HexChar(Int(ch/16)) & HexChar(ch Mod 16)
		End If
	Loop
	URLEncode = result
End Function
%>