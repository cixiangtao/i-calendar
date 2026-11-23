cask "i-calendar" do
  version "2.4.0"
  sha256 "5e1ad254687e173a3ceba138ddfb8e35826ceda51b29c31c755ec21a6f095d76"

  url "https://github.com/cixiangtao/i-calendar/releases/download/v#{version}/i-calendar-#{version}-mac-arm64.zip"
  name "i日历"
  desc "提供公农历、节气和放假调休的菜单栏日历"
  homepage "https://cixiangtao.github.io/i-calendar/"

  auto_updates true
  depends_on arch: :arm64
  depends_on macos: :ventura

  app "i日历.app"

  caveats <<~EOS
    i日历采用 ad-hoc 本地签名，尚未通过 Apple 公证。
    若 macOS 提示无法验证开发者，请到「系统设置 → 隐私与安全性」选择「仍要打开」。
  EOS
end
