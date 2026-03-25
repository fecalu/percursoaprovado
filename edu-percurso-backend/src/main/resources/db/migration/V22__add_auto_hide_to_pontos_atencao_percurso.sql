ALTER TABLE pontos_atencao_percurso
ADD COLUMN ocultar_automaticamente BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE pontos_atencao_percurso
ADD COLUMN segundos_para_ocultar INTEGER NOT NULL DEFAULT 10;
