
export const generateEmailHtml = (agentName: string, count: number) => {
    const currentDate = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Resumen de Importación</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-top: 40px; margin-bottom: 40px; }
        .header { background-color: #003da5; padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
        .stat-box { background-color: #f0f7ff; border-left: 4px solid #003da5; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .stat-number { font-size: 32px; font-weight: bold; color: #dc0030; display: block; margin-bottom: 5px; }
        .stat-label { font-size: 14px; color: #555555; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
        .footer { background-color: #f6f9fc; padding: 20px; text-align: center; font-size: 12px; color: #8898aa; border-top: 1px solid #e6ebf1; }
        .btn { display: inline-block; background-color: #dc0030; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: bold; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Nuevas Propiedades Importadas</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${agentName}</strong>,</p>
            <p>Se ha completado un proceso de importación masiva desde RE/MAX a tu plataforma de gestión.</p>
            
            <div class="stat-box">
                <span class="stat-number">${count}</span>
                <span class="stat-label">Nuevas Propiedades Cargadas</span>
            </div>

            <p>Estas propiedades ya están disponibles en tu panel para que puedas comenzar a gestionarlas, editar su información y enviarlas a tus clientes.</p>
            
            <p style="text-align: center;">
                <a href="https://tudominio.com/dashboard/propiedades" class="btn">Ver Mis Propiedades</a>
            </p>
        </div>
        <div class="footer">
            <p>Este es un mensaje automático del sistema de gestión comercial.</p>
            <p>${currentDate}</p>
        </div>
    </div>
</body>
</html>
    `;
};
