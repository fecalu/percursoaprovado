ALTER TABLE categoria_guia_blocos
    ADD COLUMN IF NOT EXISTS texto_detalhado TEXT;

ALTER TABLE categoria_guia_blocos
    ADD COLUMN IF NOT EXISTS imagem_url TEXT;

ALTER TABLE categoria_guia_blocos
    ADD COLUMN IF NOT EXISTS imagem_legenda VARCHAR(255);
