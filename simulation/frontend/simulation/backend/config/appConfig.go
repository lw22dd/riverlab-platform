package config

type AppConfig struct {
	Name         string `mapstructure:"name" yaml:"name"`
	Version      string `mapstructure:"version" yaml:"version"`
	Debug        bool   `mapstructure:"debug" yaml:"debug"`
	Environment  string `mapstructure:"environment" yaml:"environment"`
	InitData     bool   `mapstructure:"init_data" yaml:"init_data"`
	SeedBasePath string `mapstructure:"seed_base_path" yaml:"seed_base_path"`
}
