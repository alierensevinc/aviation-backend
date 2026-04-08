# SkyGuide TR - Aviation Assistant Backend

Bu proje, Türkiye havacılık sektörü hakkında uzmanlaşmış bir yapay zeka asistanı olan "SkyGuide TR" için geliştirilmiş bir **Next.js API** backend uygulamasıdır. Google'ın Gemini yapay zeka modelleriyle entegre olarak çalışır.

Projenin temel amacı sadece havacılık (havalimanları, havayolları, uçuş prosedürleri, havacılık tarihi ve kurumları) ile ilgili sorulara profesyonel ve doğru yanıtlar vermektir. Havacılık dışı soruları reddetmek üzere özelleştirilmiş bir prompt kullanır.

## Özellikler

- **Gemini AI Entegrasyonu:** `gemini-2.5-flash-lite` modeli kullanılarak yüksek performanslı yanıtlar üretilir.
- **Kapsam Kısıtlaması (System Prompt):** Modelin sadece havacılık sorularına yanıt vermesi sağlanmıştır (bkz: `app/constants/prompt.ts`).
- **Streaming (Anlık Veri Akışı):** API yanıtları bekletmek yerine chunk'lar (parçacıklar) halinde hızlıca akıtılır (`sendMessageStream`).
- **Rate Limiting (Spam Koruması):** Upstash Redis altyapısıyla IP başına 1 dakikada 5 istek limiti uygulanarak kota kalkanı sağlanmıştır.
- **Veri Validasyonu (Zod):** Boş ve geçersiz istekler API'ye ulaşmadan Schema formatına göre engellenerek filtre edilir.
- **Gelişmiş Hata Yönetimi:** Kota sınırları, güvenlik kuralları ve rate limit aşımlarına göre detaylı JSON statusları döner.
- **Güvenlik (Yetkilendirme):** API endpoint'leri `x-app-secret` header'ı ile korunur.

## Ortam Değişkenleri (.env.local)

Projeyi yerel ortamda çalıştırmak için kök dizinde bir `.env.local` dosyası oluşturmalısınız:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
APP_INTERNAL_SECRET="your_custom_secret_key"
UPSTASH_REDIS_REST_URL="https://your-database.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your_upstash_token"
```

## API Kullanımı

Projenizde `Aviation Assistant.postman_collection.json` dosyası bulunmaktadır. Bunu direkt Postman içerisine aktararak (Import) istekleri deneyebilirsiniz.

### `POST /api/chat`

Kullanıcıdan gelen soruları Gemini modeline gönderir ve Stream (Düz Metin) şeklinde akıtarak yanıtı döndürür.

**Canlı URL:**
`https://aviation-backend-rho.vercel.app/api/chat`

**Local URL:**
`http://localhost:3000/api/chat`

#### Headers

| Key            | Value              | Açıklama                                                                                                                                   |
| :------------- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Type` | `application/json` | Gönderilen verinin formatı.                                                                                                                |
| `x-app-secret` | `<X_APP_SECRET>`   | .env dosyasındaki `APP_INTERNAL_SECRET` ile aynı olmalıdır. (Canlı ortam için Postman dosyasındaki örnek veya yetkili Secret kullanılmalı) |

#### Body (JSON)

İsteklerde temel olarak göndermek istediğiniz metin `message` alanında yer alır. Modülün sohbet geçmişini hatırlaması için opsiyonel olarak `history` nesnesi gönderilebilir.

```json
{
  "message": "Türkiyedeki en eski havalimanı nerededir ?",
  "history": []
}
```

> **Not:** `history` özelliği Sliding Window (Son 5 mesaj) kurallarına tabidir. `history` objesinin formatı Gemini API'na uyumlu şekilde `[{ role: "user" | "model", parts: [{ text: "..." }] }]` olmalıdır. Postman koleksiyonundaki **api/chat with context** isteğiyle örneği inceleyebilirsiniz.

#### Örnek İstek (cURL)

```bash
curl -X POST "https://aviation-backend-rho.vercel.app/api/chat" \
     -H "Content-Type: application/json" \
     -H "x-app-secret: <SENIN_SECRET_ANAHTARIN>" \
     -d '{
           "message": "Türkiyedeki en eski havalimanı nerededir ?",
           "history": []
         }'
```

#### Örnek Başarılı Yanıt (200 OK - Streaming)

API artık JSON (`{ "answer": "..." }`) yerine, yanıtı doğrudan düz metin formatında kelime kelime ekrana akıtır (Stream). Başarılı sonuçta bir JSON dönmez ancak istemciye veriyle beraber şu **HTTP Header'lar** teslim edilir:

- `x-context-count`: Sliding window içerisinde tutulan toplam aktif geçmiş mesaj miktarını gösterir.
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`: Kalan limit değerlerini gösterir.

#### Örnek Hata Yanıtları (JSON Döner)

Aşağıdaki başarısız senaryolarda standart JSON (`{ "error": "Hata Detayı" }`) formatı dönecektir:

- **429 Too Many Requests (Rate Limit):** IP başına dakikada atılabilecek miktar (5) aşıldığında Redis engeller.
- **429 Too Many Requests (Quota):** Gemini genel kullanım API ücretsiz kotalarınız bittiğinde servis tarafından engellenirsiniz.
- **403 Forbidden:** İsteğiniz Gemini "Güvenlik veya Uygunsuz İçerik" filtresine (Safety) takıldığında fırlatılır.
- **401 Unauthorized:** Eğer `x-app-secret` header'ı eksikse veya `.env` karşılığı ile uyuşmazsa.
- **400 Bad Request:** Payload içerisinde `message` alanı tamamen boş gönderildiyse veya Zod yapılı type-safe formata uymuyorsa.
- **500 Internal Server Error:** Sunucu çökmelerinde veya Gemini servisine ulaşılamadığında.

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
