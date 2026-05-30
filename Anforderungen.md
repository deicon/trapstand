# Anforderungen
Die Anwendung unterstützt den Schützenverein bei der Erfassung von Ergebnissen am Trab Stand. 

1. Jedes Schiessen besteht aus einer sog. Rotte aus 1-6 Schützen. 
1. Geschossen werden 25 Tontauben pro Schütze Reihum. 
1. Jeder Schütze hat je Taube 2 Schuss. Wird die Taube mit einem der beiden Schüsse getroffen wird 1 Punkt addiert.
1. Zu jedem Schiessen wird ein Schiessleiter aufgeschrieben 

Üblicherweise wird von Hand auf einem Zettel mitgeschrieben. 
Pro Schiessen wird eine Tabelle geführt. 
Erste Spalte ist der Schütze
Es folgen 25 Spalten, optisch in 5er Paketen abgetrennt. In 
Jede Runde werden die Ergebnisse der 1-6 Schützen eingetragen. Dabei wird in die Spalten jeweils der kummulierte Wert je Schütze eingetragen. 
Die 26. Spalte erlaubt das Markieren des Schützen als Gast. FÜr spätere Auswertung (Steuer) notwendig. 
27. Spalte ist das Ergebnis des Schiessen pro Schütze
28. Spalte ist zum Markieren, ob der Schütze diese Runde bezahlt hat. 

# Anwendung
Die Erfassung soll möglichst auf einem Tablet ohne bzw. schlechtem Internet Zugang erfolgen. 
Idealerweise ist kein zentraler Server notwendig, sondern alle Daten werden nur auf dem Tablet im lokal Storage des Browsers gespeichert. 
Eventuell als PWA, die einmal installiert auf dem Tablet ohne Internet funktioniert. 
Sourcen werden auf einem Cloud Server abgelegt und sind idealerweise statisch. 

Schiessleiter können in der auf dem lokalen Tablet gespeicherten Schiessen navigieren, diese Exportieren als CSV oder Ausdrucken (HTML preview).
