# Dockerfile
FROM node:18-alpine

# محل کار پروژه
WORKDIR /app

# کپی فایل‌های پروژه
COPY package*.json ./
RUN npm install

COPY . .

# پورت پیش‌فرض سرور
EXPOSE 3000

CMD ["npm", "start"]