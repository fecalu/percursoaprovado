ALTER TABLE locais_prova
    ADD COLUMN imagem_principal_url VARCHAR(500),
    ADD COLUMN titulo_comercial VARCHAR(255),
    ADD COLUMN subtitulo_comercial TEXT,
    ADD COLUMN box_titulo VARCHAR(255),
    ADD COLUMN box_item_1 VARCHAR(255),
    ADD COLUMN box_item_2 VARCHAR(255),
    ADD COLUMN box_item_3 VARCHAR(255),
    ADD COLUMN box_observacao TEXT;
