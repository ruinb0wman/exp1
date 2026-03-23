//! 网络工具函数

use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpListener};

/// 获取本地局域网 IP 地址
///
/// 优先返回真实的局域网 IPv4 地址（如 192.168.x.x, 10.x.x.x, 172.16-31.x.x）
/// 过滤掉保留地址、测试地址和虚拟网卡地址
pub fn get_local_ip() -> Result<String, String> {
    // 首先尝试从所有接口获取最佳 IP
    match get_best_ipv4_from_interfaces() {
        Ok(ip) => Ok(ip),
        Err(_) => {
            // 回退到 local_ip_address 库的方法
            match local_ip_address::local_ip() {
                Ok(IpAddr::V4(ip)) => {
                    if is_valid_lan_ip(&ip) {
                        Ok(ip.to_string())
                    } else {
                        get_ipv4_from_interfaces()
                    }
                }
                Ok(IpAddr::V6(_)) => get_ipv4_from_interfaces(),
                Err(e) => Err(format!("Failed to get local IP: {}", e)),
            }
        }
    }
}

/// 检查 IP 是否是有效的局域网 IP（非保留/测试地址）
fn is_valid_lan_ip(ip: &Ipv4Addr) -> bool {
    // 排除回环地址 127.0.0.0/8
    if ip.is_loopback() {
        return false;
    }

    // 排除测试地址 198.18.0.0/15
    let octets = ip.octets();
    if octets[0] == 198 && (octets[1] == 18 || octets[1] == 19) {
        return false;
    }

    // 排除其他保留地址
    // 240.0.0.0/4 - 保留用于将来使用
    if octets[0] >= 240 {
        return false;
    }

    // 169.254.0.0/16 - 链路本地地址
    if octets[0] == 169 && octets[1] == 254 {
        return false;
    }

    true
}

/// 从网络接口中获取最佳 IPv4 地址
/// 优先顺序：192.168.x.x > 10.x.x.x > 172.16-31.x.x > 其他有效地址
fn get_best_ipv4_from_interfaces() -> Result<String, String> {
    match local_ip_address::list_afinet_netifas() {
        Ok(interfaces) => {
            let mut candidates: Vec<(String, Ipv4Addr, u8)> = Vec::new();

            for (name, ip) in interfaces {
                if let IpAddr::V4(ipv4) = ip {
                    if is_valid_lan_ip(&ipv4) {
                        // 根据 IP 段分配优先级
                        let priority = match ipv4.octets() {
                            [192, 168, _, _] => 1,     // 最高优先级：家庭/办公网络常用
                            [10, _, _, _] => 2,        // 次高优先级：大型网络
                            [172, 16..=31, _, _] => 3, // 第三优先级：中型网络
                            _ => 4,                    // 其他有效地址
                        };
                        candidates.push((name, ipv4, priority));
                    }
                }
            }

            // 按优先级排序
            candidates.sort_by_key(|(_, _, priority)| *priority);

            if let Some((name, ip, _)) = candidates.first() {
                log::info!("Selected network interface: {} with IP: {}", name, ip);
                Ok(ip.to_string())
            } else {
                Err("No valid LAN IP address found".to_string())
            }
        }
        Err(e) => Err(format!("Failed to list network interfaces: {}", e)),
    }
}

/// 从网络接口中获取 IPv4 地址（旧方法，保留作为后备）
fn get_ipv4_from_interfaces() -> Result<String, String> {
    match local_ip_address::list_afinet_netifas() {
        Ok(interfaces) => {
            for (_, ip) in interfaces {
                if let IpAddr::V4(ipv4) = ip {
                    if is_valid_lan_ip(&ipv4) {
                        return Ok(ipv4.to_string());
                    }
                }
            }
            Err("No valid LAN IP address found".to_string())
        }
        Err(e) => Err(format!("Failed to list network interfaces: {}", e)),
    }
}

/// 查找可用端口
///
/// 从起始端口开始，依次尝试，直到找到可用端口
pub fn find_available_port(start_port: u16, max_attempts: u16) -> Result<u16, String> {
    for port in start_port..(start_port + max_attempts) {
        if is_port_available(port) {
            return Ok(port);
        }
    }
    Err(format!(
        "No available port found in range {}-{}",
        start_port,
        start_port + max_attempts - 1
    ))
}

/// 检查端口是否可用
fn is_port_available(port: u16) -> bool {
    let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)), port);
    TcpListener::bind(addr).is_ok()
}

/// 生成 QR 码数据内容
///
/// 格式: base64(gzip(json))
pub fn generate_qr_data(ip: &str, port: u16) -> Result<String, String> {
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use std::io::Write;

    let data = serde_json::json!({
        "v": 1,
        "ip": ip,
        "port": port,
        "ts": chrono::Utc::now().timestamp()
    });

    let json_str =
        serde_json::to_string(&data).map_err(|e| format!("Failed to serialize QR data: {}", e))?;

    // gzip 压缩
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder
        .write_all(json_str.as_bytes())
        .map_err(|e| format!("Failed to compress QR data: {}", e))?;
    let compressed = encoder
        .finish()
        .map_err(|e| format!("Failed to finish compression: {}", e))?;

    // base64 编码
    Ok(base64::encode(compressed))
}

/// 解析 QR 码数据
pub fn parse_qr_data(data: &str) -> Result<QRPayload, String> {
    use flate2::read::GzDecoder;
    use std::io::Read;

    // base64 解码
    let compressed = base64::decode(data).map_err(|e| format!("Failed to decode base64: {}", e))?;

    // gzip 解压
    let mut decoder = GzDecoder::new(&compressed[..]);
    let mut json_str = String::new();
    decoder
        .read_to_string(&mut json_str)
        .map_err(|e| format!("Failed to decompress: {}", e))?;

    // JSON 解析
    let payload: QRPayload =
        serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(payload)
}

/// QR 码数据负载
#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct QRPayload {
    pub v: i32,
    pub ip: String,
    pub port: u16,
    pub ts: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_and_parse_qr_data() {
        let ip = "192.168.1.100";
        let port = 8765u16;

        let encoded = generate_qr_data(ip, port).unwrap();
        let decoded = parse_qr_data(&encoded).unwrap();

        assert_eq!(decoded.v, 1);
        assert_eq!(decoded.ip, ip);
        assert_eq!(decoded.port, port);
    }

    #[test]
    fn test_find_available_port() {
        // 测试应该能找到一个可用端口
        let port = find_available_port(30000, 100).unwrap();
        assert!(port >= 30000 && port < 30100);
        assert!(is_port_available(port));
    }
}
