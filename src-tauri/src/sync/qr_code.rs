//! QR 码生成

use base64::Engine;
use image::{ImageBuffer, Luma};
use qrcode::QrCode;

/// 生成 QR 码图片 (Base64 PNG)
///
/// 返回 Base64 编码的 PNG 图片，可直接用于 HTML img 标签
pub fn generate_qr_code(data: &str, size: u32) -> Result<String, String> {
    // 生成 QR 码
    let code =
        QrCode::new(data.as_bytes()).map_err(|e| format!("Failed to generate QR code: {}", e))?;

    // 渲染为图片
    let image: ImageBuffer<Luma<u8>, Vec<u8>> =
        code.render::<Luma<u8>>().min_dimensions(size, size).build();

    // 编码为 PNG
    let mut png_data: Vec<u8> = Vec::new();
    {
        let mut cursor = std::io::Cursor::new(&mut png_data);
        image
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    }

    // Base64 编码
    let base64 = base64::engine::general_purpose::STANDARD.encode(&png_data);
    Ok(format!("data:image/png;base64,{}", base64))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_qr_code() {
        let data = "https://example.com";
        let result = generate_qr_code(data, 256);
        assert!(result.is_ok());

        let base64 = result.unwrap();
        assert!(base64.starts_with("data:image/png;base64,"));
    }
}
