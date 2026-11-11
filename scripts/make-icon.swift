import AppKit

let destination = CommandLine.arguments[1]
let image = NSImage(size: NSSize(width: 1024, height: 1024))
image.lockFocus()
NSColor(calibratedRed: 0.08, green: 0.43, blue: 0.37, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 60, y: 60, width: 904, height: 904), xRadius: 208, yRadius: 208).fill()
NSColor.white.setStroke()
let outline = NSBezierPath(roundedRect: NSRect(x: 240, y: 245, width: 544, height: 530), xRadius: 65, yRadius: 65)
outline.lineWidth = 30; outline.stroke()
let header = NSBezierPath(); header.move(to: NSPoint(x: 245, y: 635)); header.line(to: NSPoint(x: 779, y: 635)); header.lineWidth = 25; header.stroke()
for x in [380.0, 644.0] {
    let binding = NSBezierPath(); binding.move(to: NSPoint(x: x, y: 718)); binding.line(to: NSPoint(x: x, y: 821)); binding.lineWidth = 33; binding.lineCapStyle = .round; binding.stroke()
}
let text: NSString = "日"
let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 230, weight: .medium), .foregroundColor: NSColor.white]
let size = text.size(withAttributes: attributes)
text.draw(at: NSPoint(x: (1024 - size.width) / 2, y: 283), withAttributes: attributes)
image.unlockFocus()
let bitmap = NSBitmapImageRep(data: image.tiffRepresentation!)!
try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: destination))
