const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = 'secreta_pit2_grao_glace';

const CATALOGO_SEED = [
  
  { nome: 'Massa Tradicional', tipo: 'MASSA', precoAdicional: 0.0 },
  { nome: 'Massa Red Velvet', tipo: 'MASSA', precoAdicional: 2.0 },
  { nome: 'Cobertura de Chocolate', tipo: 'COBERTURA', precoAdicional: 1.5 },
  { nome: 'Cobertura de Limão Siciliano', tipo: 'COBERTURA', precoAdicional: 1.5 },
  { nome: 'Cobertura de Leite Ninho', tipo: 'COBERTURA', precoAdicional: 2.0 },

  
  { nome: 'Espresso', tipo: 'CAFE_BASE', precoAdicional: 4.0 },
  { nome: 'Cappuccino', tipo: 'CAFE_BASE', precoAdicional: 5.5 },
  { nome: 'Latte', tipo: 'CAFE_BASE', precoAdicional: 5.5 },
  { nome: 'Mocha', tipo: 'CAFE_BASE', precoAdicional: 6.0 },

  { nome: 'Pequeno', tipo: 'TAMANHO', precoAdicional: 0.0 },
  { nome: 'Médio', tipo: 'TAMANHO', precoAdicional: 1.0 },
  { nome: 'Grande', tipo: 'TAMANHO', precoAdicional: 2.0 },

  { nome: 'Leite Vegetal', tipo: 'ADICIONAL_CAFE', precoAdicional: 1.0 },
  { nome: 'Xarope de Caramelo', tipo: 'ADICIONAL_CAFE', precoAdicional: 1.0 },
  { nome: 'Shot Extra', tipo: 'ADICIONAL_CAFE', precoAdicional: 1.5 },
  { nome: 'Chantilly', tipo: 'ADICIONAL_CAFE', precoAdicional: 1.0 }
];

app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

async function ensureCatalogSeeded() {
  const legacyMap = {
    CAFE_TIPO: 'CAFE_BASE',
    CAFE_TAMANHO: 'TAMANHO',
    CAFE_ADICIONAL: 'ADICIONAL_CAFE'
  };

  const legacyRows = await prisma.opcaoProduto.findMany({
    where: { tipo: { in: Object.keys(legacyMap) } }
  });

  if (legacyRows.length > 0) {
    for (const row of legacyRows) {
      await prisma.opcaoProduto.update({
        where: { id: row.id },
        data: { tipo: legacyMap[row.tipo] }
      });
    }
    console.log(`🔄 Normalizadas ${legacyRows.length} opções legadas do catálogo.`);
  }

  const existingCount = await prisma.opcaoProduto.count();

  if (existingCount > 0) {
    console.log(`📦 Catálogo já possui ${existingCount} opções. Nenhuma inserção necessária.`);
    return;
  }

  await prisma.opcaoProduto.createMany({
    data: CATALOGO_SEED,
  });

  console.log(`✅ Catálogo populado com ${CATALOGO_SEED.length} opções.`);
}


const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
};


app.post('/api/auth/register', async (req, res) => {
  const { email, senha } = req.body || {};

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const usuario = await prisma.usuario.create({
      data: { email, senha: senhaHash }
    });
    return res.status(201).json({ id: usuario.id, email: usuario.email });
  } catch (e) {
    console.error('Erro no registro:', e);
    return res.status(400).json({ error: 'E-mail já cadastrado ou dados inválidos.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const token = jwt.sign({ userId: usuario.id }, JWT_SECRET, { expiresIn: '1d' });
  return res.json({ token, usuario: { id: usuario.id, email: usuario.email } });
});



app.get('/api/opcoes', async (req, res) => {
  const opcoes = await prisma.opcaoProduto.findMany({ where: { ativo: true } });
  return res.json(opcoes);
});


app.post('/api/opcoes/seed', async (req, res) => {
  const count = await prisma.opcaoProduto.count();

  if (count === 0) {
    await prisma.opcaoProduto.createMany({
      data: CATALOGO_SEED,
    });
  }

  const opcoes = await prisma.opcaoProduto.findMany({ where: { ativo: true } });
  return res.json({ message: 'Opções populadas com sucesso', count: opcoes.length });
});




app.post('/api/pedidos', authMiddleware, async (req, res) => {
  const { itens, cepEntrega } = req.body;

  if (!itens || itens.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });

  
  const totalQuantidade = itens.reduce((acc, item) => acc + item.quantidade, 0);
  if (totalQuantidade > 50) {
    return res.status(400).json({ error: 'O pedido não pode exceder 50 itens no total.' });
  }

  let valorTotalItens = 0;
  const itensParaCriar = [];

  for (const item of itens) {
    
    
    
    const base = await prisma.opcaoProduto.findUnique({ where: { id: item.massaId } });

    if (!base) {
      return res.status(400).json({ error: 'Produto base inválido' });
    }

    if (base.tipo === 'MASSA') {
      
      const massa = base;
      let precoUnitario = 5.0 + massa.precoAdicional; 

      if (item.cobertura1Id) {
        const cob1 = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura1Id } });
        if (!cob1 || cob1.tipo !== 'COBERTURA') {
          return res.status(400).json({ error: 'Cobertura inválida' });
        }
        precoUnitario += cob1.precoAdicional;
      }

      if (item.cobertura2Id) {
        const cob2 = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura2Id } });
        if (!cob2 || cob2.tipo !== 'COBERTURA') {
          return res.status(400).json({ error: 'Cobertura inválida' });
        }
        precoUnitario += cob2.precoAdicional;
      }

      valorTotalItens += precoUnitario * item.quantidade;

      itensParaCriar.push({
        categoria: 'CUPCAKE',
        massaId: item.massaId,
        cobertura1Id: item.cobertura1Id || null,
        cobertura2Id: item.cobertura2Id || null,
        quantidade: item.quantidade,
        precoUnitario
      });
    } else if (base.tipo === 'CAFE_BASE') {
      
      
      if (!item.cobertura1Id) {
        return res.status(400).json({ error: 'Tamanho do café é obrigatório' });
      }

      const tamanho = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura1Id } });
      if (!tamanho || tamanho.tipo !== 'TAMANHO') {
        return res.status(400).json({ error: 'Tamanho de café inválido' });
      }

      let precoUnitario = base.precoAdicional + tamanho.precoAdicional; 

      if (item.cobertura2Id) {
        const adicional = await prisma.opcaoProduto.findUnique({ where: { id: item.cobertura2Id } });
        if (!adicional || adicional.tipo !== 'ADICIONAL_CAFE') {
          return res.status(400).json({ error: 'Adicional de café inválido' });
        }
        precoUnitario += adicional.precoAdicional;
      }

      valorTotalItens += precoUnitario * item.quantidade;

      itensParaCriar.push({
        categoria: 'CAFE',
        massaId: item.massaId,
        cobertura1Id: item.cobertura1Id,
        cobertura2Id: item.cobertura2Id || null,
        quantidade: item.quantidade,
        precoUnitario
      });
    } else {
      return res.status(400).json({ error: 'Produto base inválido' });
    }
  }

  
  const valorFrete = cepEntrega ? 10.0 : 0.0;
  const valorFinal = valorTotalItens + valorFrete;

  const pedido = await prisma.pedido.create({
    data: {
      usuarioId: req.userId,
      cepEntrega,
      valorFrete,
      valorTotal: valorFinal,
      status: 'AGUARDANDO_PAGAMENTO',
      itens: { create: itensParaCriar }
    },
    include: { itens: true }
  });

  return res.status(201).json(pedido);
});


app.post('/api/pedidos/:id/pix', authMiddleware, async (req, res) => {
  const { id } = req.params;

  const pedido = await prisma.pedido.findUnique({ where: { id } });
  if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

  
  const expiraEm = new Date(Date.now() + 1 * 60 * 1000);
  
  const codigoPix = `00020126580014br.gov.bcb.pix0136grao-glace-pix-key5204000053039865405${pedido.valorTotal.toFixed(2)}5802BR5910GRAO_GLACE6006MADRID62070503***6304E2CA`;

  const pagamento = await prisma.pagamento.upsert({
    where: { pedidoId: id },
    update: { codigoPix, expiraEm, status: 'PENDENTE' },
    create: {
      pedidoId: id,
      codigoPix,
      status: 'PENDENTE',
      expiraEm
    }
  });

  return res.json({
    pedidoId: pedido.id,
    valorTotal: pedido.valorTotal,
    metodo: 'PIX',
    codigoPix: pagamento.codigoPix,
    expiraEm: pagamento.expiraEm,
    status: pagamento.status
  });
});

async function startServer() {
  await ensureCatalogSeeded();
  app.listen(3000, () => console.log('server rodando'))
}

startServer().catch((error) => {
  console.error('Erro ao iniciar o servidor:', error);
  process.exit(1);
});