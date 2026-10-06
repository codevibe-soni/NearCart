import axios from 'axios';
const r = await axios.post('http://localhost:5000/api/auth/login', { email: 'student@campuscart.com', password: 'Password123!' });
const cookie = r.headers['set-cookie'][0];
const shops = await axios.get('http://localhost:5000/api/shops', { headers: { Cookie: cookie } });
console.log('Keys:', JSON.stringify(Object.keys(shops.data)));
console.log('Count data:', shops.data.data?.length);
console.log('Count shops:', shops.data.shops?.length);
if (shops.data.data) console.log('First shop:', JSON.stringify(shops.data.data[0]));
if (shops.data.shops) console.log('First shop:', JSON.stringify(shops.data.shops[0]));
