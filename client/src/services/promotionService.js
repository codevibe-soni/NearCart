import api from './api';

export const getPromotionsForShop = (shopId) => api.get(`/promotions/shop/${shopId}`);
export const getDismissedPromotions = () => api.get('/promotions/dismissed');
export const dismissPromotion = (couponId) => api.post('/promotions/dismiss', { couponId });
