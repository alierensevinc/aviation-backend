# SkyGuide TR - Aviation Assistant Backend

Bu proje, Türkiye havacılık sektörü hakkında uzmanlaşmış bir yapay zeka asistanı olan "SkyGuide TR" için geliştirilmiş bir **Next.js API** backend uygulamasıdır. Google'ın Gemini yapay zeka modelleriyle entegre olarak çalışır.

Projenin temel amacı sadece havacılık (havalimanları, havayolları, uçuş prosedürleri, havacılık tarihi ve kurumları) ile ilgili sorulara profesyonel ve doğru yanıtlar vermektir. Havacılık dışı soruları reddetmek üzere özelleştirilmiş bir prompt kullanır.

## Özellikler
- **Gemini AI Entegrasyonu:** `gemini-3-flash` (veya `1.5-flash`) modeli kullanılarak yüksek performanslı yanıtlar üretilir.
- **Kapsam Kısıtlaması (System Prompt):** Modelin sadece havacılık sorularına yanıt vermesi sağlanmıştır (bkz: `app/constants/prompt.ts`).
- **Güvenlik (Yetkilendirme):** API endpoint'leri `x-app-secret` header'ı ile korunur.
- **Veri Validasyonu:** Boş ve geçersiz istekler API'ye ulaşmadan veya AI servisini meşgul etmeden reddedilir.

## Ortam Değişkenleri (.env.local)
Projeyi yerel ortamda çalıştırmak için kök dizinde bir `.env.local` dosyası oluşturmalısınız:

```env
GEMINI_API_KEY=your_gemini_api_key_here
APP_INTERNAL_SECRET=your_custom_secret_key
```

## API Kullanımı

Projenizde `Aviation Assistant.postman_collection.json` dosyası bulunmaktadır. Bunu direkt Postman içerisine aktararak (Import) istekleri deneyebilirsiniz.

Aşağıda manuel istek atmak isteyenler için endpoint detayları yer almaktadır:

### `POST /api/chat`

Kullanıcıdan gelen soruları Gemini modeline gönderir ve yanıtı döndürür.

**Canlı URL:**
`https://aviation-backend-rho.vercel.app/api/chat`

**Local URL:**
`http://localhost:3000/api/chat`

#### Headers
| Key              | Value              | Açıklama |
| :---             | :---               | :---     |
| `Content-Type`   | `application/json` | Gönderilen verinin formatı. |
| `x-app-secret`   | `<X_APP_SECRET>`   | .env dosyasındaki `APP_INTERNAL_SECRET` ile aynı olmalıdır. (Canlı ortam için Postman dosyasındaki örnek veya yetkili Secret kullanılmalı) |

#### Body (JSON)
```json
{
  "prompt": "İstanbul Havalimanı (IST) hakkında teknik bilgi verebilir misin?"
}
```

#### Örnek İstek (cURL)

```bash
curl -X POST "https://aviation-backend-rho.vercel.app/api/chat" \
     -H "Content-Type: application/json" \
     -H "x-app-secret: <SENIN_SECRET_ANAHTARIN>" \
     -d '{
           "prompt": "İstanbul Havalimanı (IST) hakkında teknik bilgi verebilir misin?"
         }'
```

#### Örnek Başarılı Yanıt (200 OK)
```json
{
  "answer": "İstanbul Havalimanı (IST), Türkiye'nin en büyük havalimanıdır..."
}
```

#### Örnek Hata Yanıtları
- **401 Unauthorized:** Eğer `x-app-secret` eksikse veya hatalıysa.
- **400 Bad Request:** Eğer `prompt` gönderilmemişse veya boş string gönderilmişse.
- **500 Internal Server Error:** Yapay zeka servisinden kaynaklanan geçici hatalarda.

## Projeyi Çalıştırma

Gerekli bağımlılıkları indirin:
```bash
npm install
```

Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

Sunucu `http://localhost:3000` adresinde çalışmaya başlayacaktır. İsteklerinizi `http://localhost:3000/api/chat` adresine yapabilirsiniz.
