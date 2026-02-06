const axios = require('axios');

async function testAutoExtract() {
    try {
        const url = 'http://localhost:5001/api/connections/temp/auto-extract';
        const res = await axios.post(url, {
            url: 'https://www.youtube.com'
        });
        console.log('Success:', res.data);
    } catch (err) {
        console.error('Error:', err.response ? err.response.data : err.message);
    }
}

testAutoExtract();
