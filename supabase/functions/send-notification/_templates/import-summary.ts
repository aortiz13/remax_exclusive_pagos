
export const generateEmailHtml = (agentName: string, count: number) => {
    const currentDate = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Importación Completada</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; text-align: center; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-top: 40px; margin-bottom: 40px; padding: 40px 20px; }
        .icon { width: 80px; height: 80px; margin-bottom: 20px; }
        h1 { color: #1a1a1a; margin: 0 0 10px 0; font-size: 28px; font-weight: 700; }
        .greeting { font-size: 18px; color: #555; margin-bottom: 30px; }
        .description { font-size: 16px; color: #666; line-height: 1.6; margin-bottom: 30px; max-width: 480px; margin-left: auto; margin-right: auto; }
        .stat-card { background-color: #f8fbff; border: 1px solid #e1e8f0; border-radius: 12px; padding: 30px; margin-bottom: 30px; border-left: 5px solid #003da5; }
        .stat-number { font-size: 48px; font-weight: 800; color: #dc0030; display: block; line-height: 1; margin-bottom: 10px; }
        .stat-label { font-size: 14px; color: #003da5; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; }
        .btn { display: inline-block; background-color: #dc0030; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; transition: background-color 0.2s; }
        .footer { font-size: 12px; color: #999; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <img src="https://res.cloudinary.com/dhzmkxbek/image/upload/v1770314845/house_icon_import.png" alt="House Icon" class="icon" onerror="this.src='https://cdn-icons-png.flaticon.com/512/619/619153.png'">
        <h1>¡Importación Completada!</h1>
        <p class="greeting">Hola <strong>${agentName}</strong>,</p>
        
        <p class="description">
            Se ha completado exitosamente un proceso de importación masiva desde RE/MAX a tu plataforma de gestión.
        </p>

        <div class="stat-card">
            <span class="stat-number">${count}</span>
            <span class="stat-label">Nuevas Propiedades Cargadas</span>
        </div>

        <p>
            <a href="https://tudominio.com/dashboard/propiedades" class="btn">Ver Mis Propiedades</a>
        </p>

        <div class="footer">
            <p>Este es un mensaje automático del sistema de gestión comercial RE/MAX Exclusive.</p>
            <p>${currentDate}</p>
        </div>
    </div>
</body>
</html>
    `;
};
